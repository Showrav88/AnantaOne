import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import {
  buildUnitQrUrl,
  createBatchUnits,
  markUnitDefect,
  serializeProductUnit,
  voidUnusedBatchUnits,
} from "../lib/productUnits.js";
import { reconcileProductStockQty } from "../lib/productStock.js";
import {
  buildInvoiceQrUrl,
  buildTagPayload,
  confirmSell,
  reverseSell,
  serializeBatch,
  serializeOrder,
} from "../lib/sell.js";
import { requireAuth } from "../middleware/auth.js";
import {
  requireCompanyStaff,
  requireOwnerOrManager,
} from "../middleware/companyAccess.js";
import {
  branchFilter,
  canAccessBranch,
  resolveBranchScope,
} from "../lib/branchScope.js";
import { makeShortBatchCode } from "../lib/shortCodes.js";

export const ownerSellRouter = Router();

ownerSellRouter.use(requireAuth, requireCompanyStaff);

function tid(req: { auth?: { tenantId: string | null } }) {
  return req.auth!.tenantId!;
}

function publicBaseUrl(req: { headers: { origin?: string } }) {
  return (
    process.env.APP_URL ??
    req.headers.origin ??
    "https://anantaone.onrender.com"
  );
}

/* ───────── Production batches ───────── */

ownerSellRouter.get("/batches", async (req, res) => {
  const productId = req.query.productId
    ? String(req.query.productId)
    : undefined;
  const batches = await prisma.productionBatch.findMany({
    where: {
      tenantId: tid(req),
      ...(productId ? { productId } : {}),
      isActive: true,
    },
    include: {
      product: true,
      _count: { select: { units: true } },
    },
    orderBy: [{ expiresAt: "asc" }, { manufacturedAt: "desc" }],
  });
  res.json({ ok: true, batches: batches.map(serializeBatch) });
});

const batchCreateSchema = z.object({
  productId: z.string().min(1),
  batchCode: z.string().min(2).max(64).optional(),
  manufacturedAt: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  expiresAt: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .nullable()
    .optional(),
  qtyProduced: z.coerce.number().positive(),
  note: z.string().max(500).nullable().optional(),
  /** When true, also increase product.stockQty by qtyProduced */
  addToStock: z.boolean().optional().default(true),
  /** Generate unique QR unit tags for each produced item (default true). */
  generateUnitTags: z.boolean().optional().default(true),
});

function parseDate(value: string) {
  return new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
}

/** Compare calendar days in UTC (tag create date vs product create date). */
function utcDay(d: Date) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

ownerSellRouter.post(
  "/batches",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = batchCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }

    const product = await prisma.product.findFirst({
      where: { id: parsed.data.productId, tenantId: tid(req) },
    });
    if (!product) {
      res.status(404).json({ ok: false, message: "Product not found" });
      return;
    }

    const mfg = parseDate(parsed.data.manufacturedAt);

    try {
      const batch = await prisma.$transaction(async (tx) => {
        let autoCode = parsed.data.batchCode?.trim();
        if (!autoCode) {
          const prior = await tx.productionBatch.count({
            where: { tenantId: tid(req) },
          });
          let seq = prior + 1;
          autoCode = makeShortBatchCode(seq);
          for (let i = 0; i < 5000; i += 1) {
            const exists = await tx.productionBatch.findFirst({
              where: { tenantId: tid(req), batchCode: autoCode },
              select: { id: true },
            });
            if (!exists) break;
            seq += 1;
            autoCode = makeShortBatchCode(seq);
          }
        }
        const created = await tx.productionBatch.create({
          data: {
            tenantId: tid(req),
            productId: product.id,
            batchCode: autoCode.toUpperCase(),
            manufacturedAt: mfg,
            expiresAt: parsed.data.expiresAt
              ? parseDate(parsed.data.expiresAt)
              : null,
            qtyProduced: parsed.data.qtyProduced,
            qtyRemaining: parsed.data.qtyProduced,
            note: parsed.data.note ?? null,
            createdBy: req.auth!.id,
          },
          include: { product: true },
        });

        let serialStart: number | null = null;
        let serialEnd: number | null = null;
        if (parsed.data.generateUnitTags !== false) {
          const range = await createBatchUnits({
            tenantId: tid(req),
            productId: product.id,
            productSku: product.sku,
            batchId: created.id,
            batchCode: created.batchCode,
            qty: parsed.data.qtyProduced,
            tx,
          });
          serialStart = range.serialStart;
          serialEnd = range.serialEnd;
          if (serialStart != null && serialEnd != null) {
            await tx.productionBatch.update({
              where: { id: created.id },
              data: { serialStart, serialEnd },
            });
          }
        }

        if (parsed.data.addToStock) {
          await reconcileProductStockQty(
            tid(req),
            product.id,
            tx,
            req.auth!.id,
          );
        }

        return tx.productionBatch.findUniqueOrThrow({
          where: { id: created.id },
          include: {
            product: true,
            _count: { select: { units: true } },
          },
        });
      });
      res.status(201).json({ ok: true, batch: serializeBatch(batch) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed";
      res.status(400).json({ ok: false, message });
    }
  },
);

ownerSellRouter.patch(
  "/batches/:id",
  requireOwnerOrManager,
  async (req, res) => {
    const schema = z.object({
      note: z.string().max(500).nullable().optional(),
      manufacturedAt: z
        .string()
        .datetime()
        .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
        .optional(),
      expiresAt: z
        .string()
        .datetime()
        .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
        .nullable()
        .optional(),
      isActive: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }
    const existing = await prisma.productionBatch.findFirst({
      where: { id: String(req.params.id), tenantId: tid(req) },
    });
    if (!existing) {
      res.status(404).json({ ok: false, message: "Batch not found" });
      return;
    }

    const data: {
      note?: string | null;
      isActive?: boolean;
      manufacturedAt?: Date;
      expiresAt?: Date | null;
    } = {};
    if (parsed.data.note !== undefined) data.note = parsed.data.note;
    if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
    if (parsed.data.manufacturedAt) {
      data.manufacturedAt = parseDate(parsed.data.manufacturedAt);
    }
    if (parsed.data.expiresAt !== undefined) {
      data.expiresAt = parsed.data.expiresAt
        ? parseDate(parsed.data.expiresAt)
        : null;
    }

    const product = await prisma.product.findFirst({
      where: { id: existing.productId, tenantId: tid(req) },
    });
    const mfgCheck = data.manufacturedAt ?? existing.manufacturedAt;
    if (product && utcDay(mfgCheck) < utcDay(product.createdAt)) {
      res.status(400).json({
        ok: false,
        message:
          "Manufacture date cannot be before the product create date (forward only)",
      });
      return;
    }

    const expCheck =
      data.expiresAt !== undefined ? data.expiresAt : existing.expiresAt;
    if (expCheck && utcDay(expCheck) < utcDay(mfgCheck)) {
      res.status(400).json({
        ok: false,
        message: "Expiry date must be on or after manufacture date",
      });
      return;
    }

    const batch = await prisma.productionBatch.update({
      where: { id: existing.id },
      data,
      include: {
        product: true,
        _count: { select: { units: true } },
      },
    });
    res.json({ ok: true, batch: serializeBatch(batch) });
  },
);

/** Soft-delete unused production — remove stock, void tags, keep history. */
ownerSellRouter.post(
  "/batches/:id/reverse",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = z
      .object({ reason: z.string().min(5).max(500) })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        message: "Clear soft-delete reason required (min 5 characters)",
      });
      return;
    }

    const existing = await prisma.productionBatch.findFirst({
      where: { id: String(req.params.id), tenantId: tid(req) },
      include: { product: true },
    });
    if (!existing) {
      res.status(404).json({ ok: false, message: "Batch not found" });
      return;
    }
    if (existing.reversedAt || !existing.isActive) {
      res.status(400).json({ ok: false, message: "Batch already soft deleted" });
      return;
    }

    const remaining = Number(existing.qtyRemaining);
    const produced = Number(existing.qtyProduced);
    if (remaining < produced) {
      res.status(400).json({
        ok: false,
        message: `Cannot soft delete — ${produced - remaining} unit(s) already sold. Reverse those sales first.`,
      });
      return;
    }

    try {
      const batch = await prisma.$transaction(async (tx) => {
        await voidUnusedBatchUnits({
          tenantId: tid(req),
          batchId: existing.id,
          tx,
        });
        const batch = await tx.productionBatch.update({
          where: { id: existing.id },
          data: {
            qtyRemaining: 0,
            isActive: false,
            reversedAt: new Date(),
            reverseReason: parsed.data.reason.trim(),
          },
          include: {
            product: true,
            _count: { select: { units: true } },
          },
        });
        await reconcileProductStockQty(
          tid(req),
          existing.productId,
          tx,
          req.auth!.id,
        );
        return batch;
      });
      res.json({
        ok: true,
        batch: serializeBatch(batch),
        stockRemoved: remaining,
      });
    } catch (error) {
      res.status(400).json({
        ok: false,
        message: error instanceof Error ? error.message : "Reverse failed",
      });
    }
  },
);

ownerSellRouter.get(
  "/batches/:id/units",
  requireOwnerOrManager,
  async (req, res) => {
    const batch = await prisma.productionBatch.findFirst({
      where: { id: String(req.params.id), tenantId: tid(req) },
      include: {
        product: true,
        _count: { select: { units: true } },
      },
    });
    if (!batch) {
      res.status(404).json({ ok: false, message: "Batch not found" });
      return;
    }
    const status = req.query.status ? String(req.query.status) : undefined;
    const serialFrom = req.query.serialFrom
      ? Number(req.query.serialFrom)
      : undefined;
    const serialTo = req.query.serialTo
      ? Number(req.query.serialTo)
      : undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 300);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const where = {
      tenantId: tid(req),
      batchId: batch.id,
      ...(status ? { status } : {}),
      ...(serialFrom != null || serialTo != null
        ? {
            serialNo: {
              ...(serialFrom != null && Number.isFinite(serialFrom)
                ? { gte: serialFrom }
                : {}),
              ...(serialTo != null && Number.isFinite(serialTo)
                ? { lte: serialTo }
                : {}),
            },
          }
        : {}),
    };

    const [total, units] = await Promise.all([
      prisma.productUnit.count({ where }),
      prisma.productUnit.findMany({
        where,
        include: {
          product: { include: { unit: true } },
          batch: true,
        },
        orderBy: { serialNo: "asc" },
        skip: offset,
        take: limit,
      }),
    ]);

    const company = await prisma.company.findUniqueOrThrow({
      where: { id: tid(req) },
      select: { slug: true },
    });
    const base = publicBaseUrl(req);
    res.json({
      ok: true,
      batch: serializeBatch(batch),
      meta: {
        total,
        offset,
        limit,
        serialStart: batch.serialStart,
        serialEnd: batch.serialEnd,
        manufacturedAt: batch.manufacturedAt,
        expiresAt: batch.expiresAt,
      },
      units: units.map((u) => ({
        ...serializeProductUnit(u),
        /** Validation URL (serial in path) for phone + in-app scan */
        qrUrl: buildUnitQrUrl({
          publicBaseUrl: base,
          companySlug: company.slug,
          serialCode: u.serialCode,
        }),
        serialCode: u.serialCode,
      })),
    });
  },
);

/**
 * Lookup a scanned unit or sample tag (URL or bare code) for Sell / Products / Batches.
 * Query: ?q= full URL, MW001000001, or MW001/B01
 */
ownerSellRouter.get(
  "/units/lookup",
  requireOwnerOrManager,
  async (req, res) => {
    const raw = String(req.query.q ?? "").trim();
    if (!raw) {
      res.status(400).json({ ok: false, message: "Scan value required" });
      return;
    }

    const tenant = tid(req);
    const unitMatch =
      raw.match(/#\/unit\/[^/]+\/([^/?#]+)/i) ||
      raw.match(/\/unit\/[^/]+\/([^/?#]+)/i);
    const tagMatch =
      raw.match(/#\/tag\/[^/]+\/([^/?#]+)\/([^/?#]+)/i) ||
      raw.match(/\/tag\/[^/]+\/([^/?#]+)\/([^/?#]+)/i) ||
      raw.match(/^([A-Za-z0-9]{2,12})\/([A-Za-z0-9]{2,16})$/);

    if (tagMatch) {
      const sku = decodeURIComponent(tagMatch[1]!).toUpperCase();
      const batchCode = decodeURIComponent(tagMatch[2]!).toUpperCase();
      const product = await prisma.product.findFirst({
        where: { tenantId: tenant, sku },
        include: { unit: true },
      });
      if (!product) {
        res.status(404).json({ ok: false, message: "Product not found for SKU" });
        return;
      }
      const batch = await prisma.productionBatch.findFirst({
        where: { tenantId: tenant, batchCode, productId: product.id },
        include: { product: true },
      });
      if (!batch) {
        res.json({
          ok: true,
          kind: "tag",
          code: "NO_BATCH",
          product: {
            id: product.id,
            name: product.name,
            nameBn: product.nameBn,
            sku: product.sku,
            priceBdt: Number(product.priceBdt),
            isActive: product.isActive,
            stockQty: Number(product.stockQty),
          },
          batch: null,
          unit: null,
          sellableBatchCount: 0,
          canSell: false,
        });
        return;
      }
      res.json({
        ok: true,
        kind: "tag",
        product: {
          id: product.id,
          name: product.name,
          nameBn: product.nameBn,
          sku: product.sku,
          priceBdt: Number(product.priceBdt),
          isActive: product.isActive,
          stockQty: Number(product.stockQty),
        },
        batch: serializeBatch(batch),
        unit: null,
      });
      return;
    }

    const serialCode = (
      unitMatch ? decodeURIComponent(unitMatch[1]!) : raw
    )
      .trim()
      .toUpperCase();

    const unit = await prisma.productUnit.findFirst({
      where: { tenantId: tenant, serialCode },
      include: {
        product: { include: { unit: true } },
        batch: { include: { product: true } },
      },
    });
    if (!unit) {
      res.status(404).json({ ok: false, message: "Unit tag not found" });
      return;
    }

    const sellableBatches = await prisma.productionBatch.count({
      where: {
        tenantId: tenant,
        productId: unit.productId,
        isActive: true,
        qtyRemaining: { gt: 0 },
      },
    });

    res.json({
      ok: true,
      kind: "unit",
      product: {
        id: unit.product.id,
        name: unit.product.name,
        nameBn: unit.product.nameBn,
        sku: unit.product.sku,
        priceBdt: Number(unit.product.priceBdt),
        isActive: unit.product.isActive,
        stockQty: Number(unit.product.stockQty),
      },
      batch: serializeBatch(unit.batch),
      unit: serializeProductUnit(unit),
      sellableBatchCount: sellableBatches,
      canSell:
        unit.status === "IN_STOCK" &&
        unit.batch.isActive &&
        !unit.batch.reversedAt &&
        Number(unit.batch.qtyRemaining) > 0 &&
        unit.product.isActive,
    });
  },
);

ownerSellRouter.post(
  "/units/mark-defect",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = z
      .object({
        serialCode: z.string().min(2).max(128),
        reason: z.string().min(5).max(500),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }
    try {
      const unit = await markUnitDefect({
        tenantId: tid(req),
        serialCode: parsed.data.serialCode,
        reason: parsed.data.reason.trim(),
        userId: req.auth!.id,
      });
      res.json({ ok: true, unit: serializeProductUnit(unit) });
    } catch (error) {
      res.status(400).json({
        ok: false,
        message: error instanceof Error ? error.message : "Failed",
      });
    }
  },
);

/* ───────── Counter sell / orders ───────── */

ownerSellRouter.get("/orders", async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const scope = resolveBranchScope(req);
  const orders = await prisma.salesOrder.findMany({
    where: {
      tenantId: tid(req),
      ...branchFilter(scope),
      ...(status ? { status: { code: status } } : {}),
    },
    include: {
      source: true,
      status: true,
      buyer: true,
      lines: { include: { product: true, batch: true } },
    },
    orderBy: { orderedAt: "desc" },
    take: 80,
  });
  res.json({ ok: true, orders: orders.map(serializeOrder) });
});

ownerSellRouter.get("/orders/:id", async (req, res) => {
  const scope = resolveBranchScope(req);
  const order = await prisma.salesOrder.findFirst({
    where: {
      id: String(req.params.id),
      tenantId: tid(req),
      ...branchFilter(scope),
    },
    include: {
      source: true,
      status: true,
      buyer: true,
      lines: { include: { product: true, batch: true } },
    },
  });
  if (!order) {
    res.status(404).json({ ok: false, message: "Order not found" });
    return;
  }
  res.json({ ok: true, order: serializeOrder(order) });
});

ownerSellRouter.get("/orders/:id/invoice", async (req, res) => {
  const scope = resolveBranchScope(req);
  const order = await prisma.salesOrder.findFirst({
    where: {
      id: String(req.params.id),
      tenantId: tid(req),
      ...branchFilter(scope),
    },
    include: {
      source: true,
      status: true,
      buyer: true,
      lines: { include: { product: true, batch: true } },
    },
  });
  if (!order) {
    res.status(404).json({ ok: false, message: "Order not found" });
    return;
  }

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: tid(req) },
  });

  const serialized = serializeOrder(order);
  const qrValue = buildInvoiceQrUrl({
    publicBaseUrl: publicBaseUrl(req),
    companySlug: company.slug,
    invoiceCode: serialized.invoiceCode,
  });
  res.json({
    ok: true,
    invoice: {
      ...serialized,
      company: {
        name: company.name,
        slug: company.slug,
        phone: company.phone,
        address: company.address,
        tagline: company.tagline,
      },
      qrValue,
      printedAt: new Date().toISOString(),
    },
  });
});

ownerSellRouter.get("/invoices/lookup", async (req, res) => {
  const raw = String(req.query.q ?? "").trim();
  if (!raw) {
    res.status(400).json({ ok: false, message: "q required" });
    return;
  }

  // Accept full QR URL or bare invoice code
  let code = raw;
  const hashMatch = raw.match(/#\/invoice\/[^/]+\/([^/?#]+)/i);
  const pathMatch = raw.match(/\/invoice\/[^/]+\/([^/?#]+)/i);
  if (hashMatch?.[1]) code = decodeURIComponent(hashMatch[1]);
  else if (pathMatch?.[1]) code = decodeURIComponent(pathMatch[1]);
  code = code.trim().toUpperCase();

  const scope = resolveBranchScope(req);
  const order = await prisma.salesOrder.findFirst({
    where: {
      tenantId: tid(req),
      ...branchFilter(scope),
      OR: [
        { invoiceCode: { equals: code, mode: "insensitive" } },
        { id: raw },
      ],
    },
    include: {
      source: true,
      status: true,
      buyer: true,
      lines: { include: { product: true, batch: true } },
    },
  });
  if (!order) {
    res.status(404).json({ ok: false, message: "Invoice not found" });
    return;
  }

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: tid(req) },
  });
  const serialized = serializeOrder(order);
  res.json({
    ok: true,
    invoice: {
      ...serialized,
      company: {
        name: company.name,
        slug: company.slug,
        phone: company.phone,
        address: company.address,
        tagline: company.tagline,
      },
      qrValue: buildInvoiceQrUrl({
        publicBaseUrl: publicBaseUrl(req),
        companySlug: company.slug,
        invoiceCode: serialized.invoiceCode,
      }),
    },
  });
});

const reverseSchema = z.object({
  reason: z.string().min(5).max(500),
});

ownerSellRouter.post(
  "/orders/:id/reverse",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = reverseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        message: "Clear reverse reason required (min 5 characters)",
      });
      return;
    }
    try {
      const scope = resolveBranchScope(req);
      const existing = await prisma.salesOrder.findFirst({
        where: { id: String(req.params.id), tenantId: tid(req) },
        select: { branchId: true },
      });
      if (!existing || !canAccessBranch(scope, existing.branchId)) {
        res.status(403).json({
          ok: false,
          message: "Order not found or belongs to another branch",
        });
        return;
      }
      const result = await reverseSell({
        tenantId: tid(req),
        userId: req.auth!.id,
        orderId: String(req.params.id),
        reason: parsed.data.reason,
      });
      res.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Reverse failed";
      res.status(400).json({ ok: false, message });
    }
  },
);

const sellSchema = z.object({
  sourceCode: z
    .enum(["PHONE", "ONLINE", "WALK_IN", "COUNTER"])
    .default("COUNTER"),
  buyerId: z.string().nullable().optional(),
  buyerName: z.string().max(160).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  creditWallet: z.boolean().optional(),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.coerce.number().positive(),
        unitPriceBdt: z.coerce.number().nonnegative().optional(),
        batchId: z.string().nullable().optional(),
        unitSerialCode: z.string().max(32).nullable().optional(),
      }),
    )
    .min(1),
});

ownerSellRouter.post(
  "/sell",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = sellSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }
    const scope = resolveBranchScope(req);
    let branchId = scope.branchId;
    if (req.auth!.roleCode === "OWNER") {
      // Owner counter sales stamp the selected branch when one is active.
      branchId = scope.mode === "one" ? scope.branchId : req.auth!.branchId;
    } else if (!branchId) {
      res.status(400).json({
        ok: false,
        message: "Staff must be assigned to a branch before selling",
      });
      return;
    }
    try {
      const result = await confirmSell({
        tenantId: tid(req),
        userId: req.auth!.id,
        sourceCode: parsed.data.sourceCode,
        buyerId: parsed.data.buyerId,
        buyerName: parsed.data.buyerName,
        note: parsed.data.note,
        branchId,
        lines: parsed.data.lines,
        creditWallet: parsed.data.creditWallet,
      });
      res.status(201).json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sell failed";
      res.status(400).json({ ok: false, message });
    }
  },
);

ownerSellRouter.get("/sell/lookups", async (_req, res) => {
  const [sources, statuses] = await Promise.all([
    prisma.orderSourceLookup.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.orderStatusLookup.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  res.json({
    ok: true,
    sources: sources.map((s) => ({
      code: s.code,
      nameEn: s.nameEn,
      nameBn: s.nameBn,
    })),
    statuses: statuses.map((s) => ({
      code: s.code,
      nameEn: s.nameEn,
      nameBn: s.nameBn,
    })),
  });
});

/* ───────── Tag templates + print payload ───────── */

function serializeTemplate(t: {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  showSku: boolean;
  showPrice: boolean;
  showDescription: boolean;
  showMfgDate: boolean;
  showExpDate: boolean;
  showBatch: boolean;
  showQr: boolean;
  showCompany: boolean;
  tagDescription: string | null;
  isDefault: boolean;
}) {
  return {
    id: t.id,
    name: t.name,
    widthMm: t.widthMm,
    heightMm: t.heightMm,
    showSku: t.showSku,
    showPrice: t.showPrice,
    showDescription: t.showDescription,
    showMfgDate: t.showMfgDate,
    showExpDate: t.showExpDate,
    showBatch: t.showBatch,
    showQr: t.showQr,
    showCompany: t.showCompany,
    tagDescription: t.tagDescription,
    isDefault: t.isDefault,
  };
}

ownerSellRouter.get("/tags/templates", async (req, res) => {
  const templates = await prisma.tagTemplate.findMany({
    where: { tenantId: tid(req) },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  res.json({ ok: true, templates: templates.map(serializeTemplate) });
});

const templateSchema = z.object({
  name: z.string().min(2).max(80),
  widthMm: z.coerce.number().int().min(20).max(200).default(50),
  heightMm: z.coerce.number().int().min(15).max(200).default(30),
  showSku: z.boolean().optional(),
  showPrice: z.boolean().optional(),
  showDescription: z.boolean().optional(),
  showMfgDate: z.boolean().optional(),
  showExpDate: z.boolean().optional(),
  showBatch: z.boolean().optional(),
  showQr: z.boolean().optional(),
  showCompany: z.boolean().optional(),
  tagDescription: z.string().max(500).nullable().optional(),
  isDefault: z.boolean().optional(),
});

ownerSellRouter.post(
  "/tags/templates",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }
    const template = await prisma.$transaction(async (tx) => {
      if (parsed.data.isDefault) {
        await tx.tagTemplate.updateMany({
          where: { tenantId: tid(req) },
          data: { isDefault: false },
        });
      }
      return tx.tagTemplate.create({
        data: {
          tenantId: tid(req),
          name: parsed.data.name,
          widthMm: parsed.data.widthMm,
          heightMm: parsed.data.heightMm,
          showSku: parsed.data.showSku ?? true,
          showPrice: parsed.data.showPrice ?? true,
          showDescription: parsed.data.showDescription ?? true,
          showMfgDate: parsed.data.showMfgDate ?? true,
          showExpDate: parsed.data.showExpDate ?? true,
          showBatch: parsed.data.showBatch ?? true,
          showQr: parsed.data.showQr ?? true,
          showCompany: parsed.data.showCompany ?? true,
          tagDescription: parsed.data.tagDescription ?? null,
          isDefault: parsed.data.isDefault ?? false,
        },
      });
    });
    res.status(201).json({ ok: true, template: serializeTemplate(template) });
  },
);

ownerSellRouter.patch(
  "/tags/templates/:id",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = templateSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }
    const existing = await prisma.tagTemplate.findFirst({
      where: { id: String(req.params.id), tenantId: tid(req) },
    });
    if (!existing) {
      res.status(404).json({ ok: false, message: "Template not found" });
      return;
    }
    const template = await prisma.$transaction(async (tx) => {
      if (parsed.data.isDefault) {
        await tx.tagTemplate.updateMany({
          where: { tenantId: tid(req) },
          data: { isDefault: false },
        });
      }
      return tx.tagTemplate.update({
        where: { id: existing.id },
        data: parsed.data,
      });
    });
    res.json({ ok: true, template: serializeTemplate(template) });
  },
);

ownerSellRouter.post(
  "/tags/preview",
  requireOwnerOrManager,
  async (req, res) => {
    const schema = z.object({
      productId: z.string().min(1),
      batchId: z.string().min(1),
      templateId: z.string().optional(),
      /** Override dates printed on tag (and optionally saved to batch). */
      manufacturedAt: z
        .string()
        .datetime()
        .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
        .optional(),
      expiresAt: z
        .string()
        .datetime()
        .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
        .nullable()
        .optional(),
      /** Persist date changes onto the production batch. */
      saveDatesToBatch: z.boolean().optional(),
      /** One-off print size override (mm). */
      widthMm: z.coerce.number().int().min(20).max(200).optional(),
      heightMm: z.coerce.number().int().min(15).max(200).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }

    const [company, product, batch, template] = await Promise.all([
      prisma.company.findUniqueOrThrow({ where: { id: tid(req) } }),
      prisma.product.findFirst({
        where: { id: parsed.data.productId, tenantId: tid(req) },
      }),
      prisma.productionBatch.findFirst({
        where: { id: parsed.data.batchId, tenantId: tid(req) },
      }),
      parsed.data.templateId
        ? prisma.tagTemplate.findFirst({
            where: { id: parsed.data.templateId, tenantId: tid(req) },
          })
        : prisma.tagTemplate.findFirst({
            where: { tenantId: tid(req), isDefault: true },
          }),
    ]);

    if (!product || !batch) {
      res.status(404).json({ ok: false, message: "Product or batch not found" });
      return;
    }

    // Create/MFG date defaults from product.createdAt; tag may move it forward only.
    const productCreated = product.createdAt;
    let manufacturedAt = productCreated;
    if (parsed.data.manufacturedAt) {
      manufacturedAt = parseDate(parsed.data.manufacturedAt);
    }
    if (utcDay(manufacturedAt) < utcDay(productCreated)) {
      res.status(400).json({
        ok: false,
        message:
          "Tag create/MFG date cannot be before the product create date (forward only)",
      });
      return;
    }

    // Expiry is decided at tag print time — required for preview/print.
    if (parsed.data.expiresAt == null || parsed.data.expiresAt === "") {
      res.status(400).json({
        ok: false,
        message: "Expiry date is required when printing the tag",
      });
      return;
    }
    const expiresAt = parseDate(parsed.data.expiresAt);
    if (utcDay(expiresAt) < utcDay(manufacturedAt)) {
      res.status(400).json({
        ok: false,
        message: "Expiry date must be on or after the tag create/MFG date",
      });
      return;
    }

    if (parsed.data.saveDatesToBatch) {
      await prisma.productionBatch.update({
        where: { id: batch.id },
        data: { manufacturedAt, expiresAt },
      });
    }

    const tplBase =
      template ??
      ({
        widthMm: 50,
        heightMm: 30,
        showSku: true,
        showPrice: true,
        showDescription: true,
        showMfgDate: true,
        showExpDate: true,
        showBatch: true,
        showQr: true,
        showCompany: true,
        tagDescription: null,
      } as const);

    const tpl = {
      ...tplBase,
      widthMm: parsed.data.widthMm ?? tplBase.widthMm,
      heightMm: parsed.data.heightMm ?? tplBase.heightMm,
    };

    const tag = buildTagPayload({
      company: {
        name: company.name,
        slug: company.slug,
        phone: company.phone,
      },
      product: {
        name: product.name,
        nameBn: product.nameBn,
        sku: product.sku,
        priceBdt: Number(product.priceBdt),
        description: product.description,
      },
      batch: {
        batchCode: batch.batchCode,
        manufacturedAt,
        expiresAt,
      },
      template: tpl,
      publicBaseUrl: publicBaseUrl(req),
    });

    res.json({
      ok: true,
      tag,
      productCreatedAt: productCreated,
      batchDatesSaved: Boolean(parsed.data.saveDatesToBatch),
    });
  },
);
