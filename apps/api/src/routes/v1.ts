import { Router } from "express";
import { z } from "zod";
import { serializeOrder } from "../lib/sell.js";
import { quoteOrderTotals, normalizeCategory } from "../lib/delivery.js";
import { placeOnlineOrder, serializeOnlineOrder } from "../lib/onlineOrder.js";
import { prisma } from "../db.js";

export const v1Router = Router();

v1Router.get("/overview", async (_req, res) => {
  try {
    const company = await prisma.company.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      include: {
        branches: { orderBy: { createdAt: "asc" }, take: 5 },
        _count: { select: { users: true, buyers: true } },
      },
    });

    if (!company) {
      res.status(404).json({
        ok: false,
        message: "No company found. Run npm run db:seed.",
      });
      return;
    }

    res.json({
      ok: true,
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        locale: company.locale,
        branches: company.branches.map((b) => ({
          id: b.id,
          name: b.name,
          address: b.address,
        })),
        counts: {
          users: company._count.users,
          buyers: company._count.buyers,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(500).json({ ok: false, message });
  }
});

v1Router.get("/buyers", async (_req, res) => {
  try {
    const company = await prisma.company.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (!company) {
      res.json({ ok: true, buyers: [] });
      return;
    }

    const buyers = await prisma.buyer.findMany({
      where: { tenantId: company.id, isActive: true },
      orderBy: { shopName: "asc" },
      select: {
        id: true,
        shopName: true,
        phone: true,
        address: true,
        locale: true,
      },
    });

    res.json({ ok: true, buyers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(500).json({ ok: false, message, buyers: [] });
  }
});

v1Router.get("/products", async (_req, res) => {
  try {
    const company = await prisma.company.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (!company) {
      res.json({ ok: true, products: [] });
      return;
    }

    const products = await prisma.product.findMany({
      where: { tenantId: company.id, isActive: true },
      include: { unit: true },
      orderBy: { name: "asc" },
      take: 24,
    });

    res.json({
      ok: true,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        nameBn: p.nameBn,
        sku: p.sku,
        category: p.category,
        unit: p.unit.code,
        priceBdt: Number(p.priceBdt),
        stockQty: Number(p.stockQty),
        minStock: Number(p.minStock),
        description: p.description,
        imageUrl: p.imageUrl,
        isActive: p.isActive,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(500).json({ ok: false, message, products: [] });
  }
});

/** Public multi-tenant shop site — branding, hero, catalog. */
v1Router.get("/shop/:companySlug", async (req, res) => {
  try {
    const companySlug = String(req.params.companySlug);
    const company = await prisma.company.findUnique({
      where: { slug: companySlug },
      include: {
        branches: { orderBy: { createdAt: "asc" }, take: 5 },
        division: true,
        district: true,
        upazila: true,
        deliverySettings: true,
      },
    });
    if (!company || !company.isActive) {
      res.status(404).json({ ok: false, message: "Shop not found" });
      return;
    }

    const branchId = req.query.branchId
      ? String(req.query.branchId)
      : undefined;

    const [products, wards] = await Promise.all([
      prisma.product.findMany({
        where: { tenantId: company.id, isActive: true },
        include: { unit: true },
        orderBy: { name: "asc" },
        take: 48,
      }),
      prisma.deliveryWard.findMany({
        where: {
          tenantId: company.id,
          isActive: true,
          OR: [
            { branchId: null },
            ...(branchId ? [{ branchId }] : []),
          ],
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    ]);

    const settings = company.deliverySettings;

    res.json({
      ok: true,
      shop: {
        name: company.name,
        slug: company.slug,
        locale: company.locale,
        phone: company.phone,
        address: company.address,
        divisionId: company.divisionId,
        districtId: company.districtId,
        upazilaId: company.upazilaId,
        division: company.division
          ? {
              id: company.division.id,
              name: company.division.name,
              nameBn: company.division.nameBn,
            }
          : null,
        district: company.district
          ? {
              id: company.district.id,
              name: company.district.name,
              nameBn: company.district.nameBn,
            }
          : null,
        upazila: company.upazila
          ? {
              id: company.upazila.id,
              name: company.upazila.name,
              nameBn: company.upazila.nameBn,
            }
          : null,
        deliveryCharges: {
          outsideAreaBdt: Number(settings?.outsideAreaChargeBdt ?? 80),
          sameDistrictBdt: Number(settings?.sameDistrictChargeBdt ?? 120),
          otherDistrictBdt: Number(settings?.otherDistrictChargeBdt ?? 250),
        },
        tagline: company.tagline,
        description: company.description,
        logoUrl: company.logoUrl,
        heroImageUrl: company.heroImageUrl,
        heroVideoUrl: company.heroVideoUrl,
        brandPrimary: company.brandPrimary ?? "#0f6b4c",
        brandAccent: company.brandAccent ?? "#f42a41",
        brandBg: company.brandBg ?? "#06281f",
        brandFont: company.brandFont ?? "source-sans",
        siteHeadline: company.siteHeadline ?? company.name,
        siteSubhead:
          company.siteSubhead ?? company.tagline ?? company.description,
        branches: company.branches.map((b) => ({
          id: b.id,
          name: b.name,
          address: b.address,
        })),
        wards: wards.map((w) => ({
          id: w.id,
          name: w.name,
          nameBn: w.nameBn,
          districtId: w.districtId,
          upazilaId: w.upazilaId,
          freeDelivery: w.freeDelivery,
          baseChargeBdt: Number(w.baseChargeBdt),
        })),
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          nameBn: p.nameBn,
          sku: p.sku,
          category: normalizeCategory(p.category),
          unit: p.unit.code,
          priceBdt: Number(p.priceBdt),
          stockQty: Number(p.stockQty),
          description: p.description,
          imageUrl: p.imageUrl,
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(500).json({ ok: false, message });
  }
});

v1Router.get("/shop/:companySlug/products/:productId", async (req, res) => {
  try {
    const company = await prisma.company.findUnique({
      where: { slug: String(req.params.companySlug) },
    });
    if (!company?.isActive) {
      res.status(404).json({ ok: false, message: "Shop not found" });
      return;
    }
    const product = await prisma.product.findFirst({
      where: {
        id: String(req.params.productId),
        tenantId: company.id,
        isActive: true,
      },
      include: { unit: true },
    });
    if (!product) {
      res.status(404).json({ ok: false, message: "Product not found" });
      return;
    }
    res.json({
      ok: true,
      product: {
        id: product.id,
        name: product.name,
        nameBn: product.nameBn,
        sku: product.sku,
        category: normalizeCategory(product.category),
        unit: product.unit.code,
        priceBdt: Number(product.priceBdt),
        stockQty: Number(product.stockQty),
        description: product.description,
        imageUrl: product.imageUrl,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(500).json({ ok: false, message });
  }
});

const quoteSchema = z.object({
  districtId: z.string().cuid().nullable().optional(),
  upazilaId: z.string().cuid().nullable().optional(),
  wardId: z.string().cuid().nullable().optional(),
  branchId: z.string().cuid().nullable().optional(),
  couponCode: z.string().max(40).nullable().optional(),
  lines: z
    .array(
      z.object({
        productId: z.string().cuid(),
        qty: z.coerce.number().positive(),
      }),
    )
    .min(1),
});

v1Router.post("/shop/:companySlug/quote", async (req, res) => {
  try {
    const company = await prisma.company.findUnique({
      where: { slug: String(req.params.companySlug) },
    });
    if (!company?.isActive) {
      res.status(404).json({ ok: false, message: "Shop not found" });
      return;
    }
    const parsed = quoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }
    const products = await prisma.product.findMany({
      where: {
        tenantId: company.id,
        id: { in: parsed.data.lines.map((l) => l.productId) },
        isActive: true,
      },
    });
    const map = new Map(products.map((p) => [p.id, p]));
    const lines = parsed.data.lines.map((l) => {
      const p = map.get(l.productId);
      if (!p) throw new Error("Product not found");
      return {
        productId: p.id,
        category: p.category,
        qty: l.qty,
        unitPriceBdt: Number(p.priceBdt),
      };
    });
    const quote = await quoteOrderTotals(company.id, {
      lines,
      wardId: parsed.data.wardId,
      districtId: parsed.data.districtId,
      upazilaId: parsed.data.upazilaId,
      branchId: parsed.data.branchId,
      couponCode: parsed.data.couponCode,
    });
    res.json({ ok: true, quote });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quote failed";
    res.status(400).json({ ok: false, message });
  }
});

const checkoutSchema = quoteSchema.extend({
  shopName: z.string().min(2).max(160),
  clientName: z.string().min(2).max(120),
  phone: z.string().min(6).max(32),
  address: z.string().min(4).max(240),
  note: z.string().max(500).nullable().optional(),
}).refine(
  (v) => Boolean(v.wardId || v.districtId),
  { message: "Select district (and ward if available)" },
);

v1Router.post("/shop/:companySlug/checkout", async (req, res) => {
  try {
    const company = await prisma.company.findUnique({
      where: { slug: String(req.params.companySlug) },
    });
    if (!company?.isActive) {
      res.status(404).json({ ok: false, message: "Shop not found" });
      return;
    }
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }
    const { order, quote } = await placeOnlineOrder({
      tenantId: company.id,
      branchId: parsed.data.branchId,
      shopName: parsed.data.shopName,
      clientName: parsed.data.clientName,
      phone: parsed.data.phone,
      address: parsed.data.address,
      districtId: parsed.data.districtId,
      upazilaId: parsed.data.upazilaId,
      wardId: parsed.data.wardId,
      couponCode: parsed.data.couponCode,
      note: parsed.data.note,
      lines: parsed.data.lines,
    });
    res.status(201).json({
      ok: true,
      quote,
      order: serializeOnlineOrder(order),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed";
    res.status(400).json({ ok: false, message });
  }
});

/** Public invoice QR lookup — find a sale by company + invoice code. */
v1Router.get("/invoice/:companySlug/:invoiceCode", async (req, res) => {
  try {
    const companySlug = String(req.params.companySlug);
    const invoiceCode = decodeURIComponent(
      String(req.params.invoiceCode),
    ).toUpperCase();

    const company = await prisma.company.findUnique({
      where: { slug: companySlug },
    });
    if (!company || !company.isActive) {
      res.status(404).json({ ok: false, message: "Company not found" });
      return;
    }

    const order = await prisma.salesOrder.findFirst({
      where: {
        tenantId: company.id,
        invoiceCode: { equals: invoiceCode, mode: "insensitive" },
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
          logoUrl: company.logoUrl,
          brandPrimary: company.brandPrimary,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(500).json({ ok: false, message });
  }
});

/** Public QR tag lookup — no auth (scanned from product sticker). */
v1Router.get("/tag/:companySlug/:sku/:batchCode", async (req, res) => {
  try {
    const companySlug = String(req.params.companySlug);
    const sku = decodeURIComponent(String(req.params.sku));
    const batchCode = decodeURIComponent(String(req.params.batchCode));

    const company = await prisma.company.findUnique({
      where: { slug: companySlug },
    });
    if (!company || !company.isActive) {
      res.status(404).json({ ok: false, message: "Company not found" });
      return;
    }

    const product = await prisma.product.findFirst({
      where: { tenantId: company.id, sku, isActive: true },
      include: { unit: true },
    });
    if (!product) {
      res.status(404).json({ ok: false, message: "Product not found" });
      return;
    }

    const batch = await prisma.productionBatch.findFirst({
      where: {
        tenantId: company.id,
        productId: product.id,
        batchCode: batchCode.toUpperCase(),
      },
    });
    if (!batch) {
      res.status(404).json({ ok: false, message: "Batch not found" });
      return;
    }

    res.json({
      ok: true,
      tag: {
        company: {
          name: company.name,
          phone: company.phone,
          address: company.address,
          logoUrl: company.logoUrl,
          brandPrimary: company.brandPrimary,
        },
        product: {
          name: product.name,
          nameBn: product.nameBn,
          sku: product.sku,
          size: product.size == null ? null : Number(product.size),
          unit: product.unit.code,
          unitLabel: {
            en: product.unit.nameEn,
            bn: product.unit.nameBn,
          },
          priceBdt: Number(product.priceBdt),
          description: product.description,
          imageUrl: product.imageUrl,
        },
        batch: {
          batchCode: batch.batchCode,
          manufacturedAt: batch.manufacturedAt,
          expiresAt: batch.expiresAt,
          qtyRemaining: Number(batch.qtyRemaining),
          serialStart: batch.serialStart,
          serialEnd: batch.serialEnd,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(500).json({ ok: false, message });
  }
});

function serializePublicUnit(
  company: {
    name: string;
    phone: string | null;
    logoUrl: string | null;
    brandPrimary: string | null;
    slug: string;
  },
  unit: {
    serialNo: number;
    serialCode: string;
    status: string;
    soldAt: Date | null;
    product: {
      name: string;
      nameBn: string | null;
      sku: string;
      gtin: string | null;
      size: { toString(): string } | number | string | null;
      priceBdt: { toString(): string } | number | string;
      description: string | null;
      imageUrl: string | null;
      unit: { code: string; nameEn: string; nameBn: string };
    };
    batch: {
      batchCode: string;
      manufacturedAt: Date;
      expiresAt: Date | null;
      serialStart: number | null;
      serialEnd: number | null;
    };
  },
) {
  return {
    serialNo: unit.serialNo,
    serialCode: unit.serialCode,
    status: unit.status,
    soldAt: unit.soldAt,
    company: {
      name: company.name,
      slug: company.slug,
      phone: company.phone,
      logoUrl: company.logoUrl,
      brandPrimary: company.brandPrimary,
    },
    product: {
      name: unit.product.name,
      nameBn: unit.product.nameBn,
      sku: unit.product.sku,
      gtin: unit.product.gtin,
      size: unit.product.size == null ? null : Number(unit.product.size),
      unit: unit.product.unit.code,
      unitLabel: {
        en: unit.product.unit.nameEn,
        bn: unit.product.unit.nameBn,
      },
      priceBdt: Number(unit.product.priceBdt),
      description: unit.product.description,
      imageUrl: unit.product.imageUrl,
    },
    batch: {
      batchCode: unit.batch.batchCode,
      manufacturedAt: unit.batch.manufacturedAt,
      expiresAt: unit.batch.expiresAt,
      serialStart: unit.batch.serialStart,
      serialEnd: unit.batch.serialEnd,
    },
  };
}

/** Public unique unit QR lookup — one bottle / item. */
v1Router.get("/unit/:companySlug/:serialCode", async (req, res) => {
  try {
    const companySlug = String(req.params.companySlug);
    const serialCode = decodeURIComponent(String(req.params.serialCode));
    const company = await prisma.company.findUnique({
      where: { slug: companySlug },
    });
    if (!company || !company.isActive) {
      res.status(404).json({ ok: false, message: "Company not found" });
      return;
    }

    const unit = await prisma.productUnit.findFirst({
      where: { tenantId: company.id, serialCode },
      include: {
        product: { include: { unit: true } },
        batch: true,
      },
    });
    if (!unit) {
      res.status(404).json({ ok: false, message: "Unit tag not found" });
      return;
    }

    res.json({
      ok: true,
      unit: serializePublicUnit(company, unit),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(500).json({ ok: false, message });
  }
});

/**
 * GS1 Digital Link resolver — GTIN (AI 01) + serial (AI 21).
 * Path: /api/v1/gs1/01/:gtin/21/:serial
 */
v1Router.get("/gs1/01/:gtin/21/:serial", async (req, res) => {
  try {
    const rawGtin = String(req.params.gtin).replace(/\D/g, "");
    const serialCode = decodeURIComponent(String(req.params.serial));
    const gtin13 =
      rawGtin.length === 14 && rawGtin.startsWith("0")
        ? rawGtin.slice(1)
        : rawGtin;
    const candidates = [gtin13, rawGtin].filter(
      (v, i, arr) => v.length >= 12 && arr.indexOf(v) === i,
    );

    const product = await prisma.product.findFirst({
      where: { gtin: { in: candidates }, isActive: true },
      include: { company: true },
    });
    if (!product || !product.company.isActive) {
      res.status(404).json({ ok: false, message: "GTIN not found" });
      return;
    }

    const unit = await prisma.productUnit.findFirst({
      where: { tenantId: product.tenantId, serialCode },
      include: {
        product: { include: { unit: true } },
        batch: true,
      },
    });
    if (!unit) {
      res.status(404).json({ ok: false, message: "Unit tag not found" });
      return;
    }
    if (unit.productId !== product.id) {
      res.status(404).json({ ok: false, message: "Serial does not match GTIN" });
      return;
    }

    res.json({
      ok: true,
      unit: serializePublicUnit(product.company, unit),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(500).json({ ok: false, message });
  }
});
