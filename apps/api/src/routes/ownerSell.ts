import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
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
    include: { product: true },
    orderBy: [{ expiresAt: "asc" }, { manufacturedAt: "desc" }],
  });
  res.json({ ok: true, batches: batches.map(serializeBatch) });
});

const batchCreateSchema = z.object({
  productId: z.string().min(1),
  batchCode: z.string().min(2).max(64),
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
});

function parseDate(value: string) {
  return new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
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

    try {
      const batch = await prisma.$transaction(async (tx) => {
        const created = await tx.productionBatch.create({
          data: {
            tenantId: tid(req),
            productId: product.id,
            batchCode: parsed.data.batchCode.trim().toUpperCase(),
            manufacturedAt: parseDate(parsed.data.manufacturedAt),
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
        if (parsed.data.addToStock) {
          await tx.product.update({
            where: { id: product.id },
            data: {
              stockQty: Number(product.stockQty) + parsed.data.qtyProduced,
              updatedBy: req.auth!.id,
            },
          });
        }
        return created;
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
    const batch = await prisma.productionBatch.update({
      where: { id: existing.id },
      data: {
        note: parsed.data.note,
        isActive: parsed.data.isActive,
        ...(parsed.data.expiresAt !== undefined
          ? {
              expiresAt: parsed.data.expiresAt
                ? parseDate(parsed.data.expiresAt)
                : null,
            }
          : {}),
      },
      include: { product: true },
    });
    res.json({ ok: true, batch: serializeBatch(batch) });
  },
);

/* ───────── Counter sell / orders ───────── */

ownerSellRouter.get("/orders", async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const orders = await prisma.salesOrder.findMany({
    where: {
      tenantId: tid(req),
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
  const order = await prisma.salesOrder.findFirst({
    where: { id: String(req.params.id), tenantId: tid(req) },
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
  const order = await prisma.salesOrder.findFirst({
    where: { id: String(req.params.id), tenantId: tid(req) },
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

  const order = await prisma.salesOrder.findFirst({
    where: {
      tenantId: tid(req),
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
    try {
      const result = await confirmSell({
        tenantId: tid(req),
        userId: req.auth!.id,
        sourceCode: parsed.data.sourceCode,
        buyerId: parsed.data.buyerId,
        buyerName: parsed.data.buyerName,
        note: parsed.data.note,
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

    const tpl =
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
        manufacturedAt: batch.manufacturedAt,
        expiresAt: batch.expiresAt,
      },
      template: tpl,
      publicBaseUrl: publicBaseUrl(req),
    });

    res.json({ ok: true, tag });
  },
);
