import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { attachOwnerContext, requireOwner } from "../middleware/ownerContext.js";

export const ownerRouter = Router();

ownerRouter.use(attachOwnerContext);

ownerRouter.get("/dashboard", async (req, res) => {
  const tenantId = req.owner!.tenantId;

  const [company, productCount, buyerCount, lowStock, recentProducts] =
    await Promise.all([
      prisma.company.findUniqueOrThrow({
        where: { id: tenantId },
        include: {
          branches: { orderBy: { createdAt: "asc" }, take: 5 },
          _count: { select: { users: true, buyers: true, products: true } },
        },
      }),
      prisma.product.count({ where: { tenantId, isActive: true } }),
      prisma.buyer.count({ where: { tenantId, isActive: true } }),
      prisma.product.findMany({
        where: {
          tenantId,
          isActive: true,
          // stockQty <= minStock — filter in JS for Decimal safety
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      prisma.product.findMany({
        where: { tenantId },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ]);

  const lowStockItems = lowStock
    .filter((p) => Number(p.stockQty) <= Number(p.minStock))
    .slice(0, 8)
    .map(serializeProduct);

  res.json({
    ok: true,
    role: req.owner!.role,
    dashboard: {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
        locale: company.locale,
        phone: company.phone,
        address: company.address,
        tagline: company.tagline,
        description: company.description,
        branches: company.branches,
        counts: company._count,
      },
      stats: {
        products: productCount,
        buyers: buyerCount,
        lowStock: lowStockItems.length,
        users: company._count.users,
      },
      lowStock: lowStockItems,
      recentProducts: recentProducts.map(serializeProduct),
    },
  });
});

ownerRouter.get("/company", async (req, res) => {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: req.owner!.tenantId },
    include: {
      branches: { orderBy: { createdAt: "asc" } },
      _count: { select: { users: true, buyers: true, products: true } },
    },
  });

  res.json({
    ok: true,
    role: req.owner!.role,
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      locale: company.locale,
      phone: company.phone,
      address: company.address,
      tagline: company.tagline,
      description: company.description,
      branches: company.branches,
      counts: company._count,
    },
  });
});

const companyUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(32).nullable().optional(),
  address: z.string().max(240).nullable().optional(),
  tagline: z.string().max(160).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  locale: z.enum(["bn", "en"]).optional(),
});

ownerRouter.patch("/company", requireOwner, async (req, res) => {
  const parsed = companyUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: parsed.error.message });
    return;
  }

  const company = await prisma.company.update({
    where: { id: req.owner!.tenantId },
    data: parsed.data,
    include: {
      branches: { orderBy: { createdAt: "asc" } },
      _count: { select: { users: true, buyers: true, products: true } },
    },
  });

  res.json({
    ok: true,
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      locale: company.locale,
      phone: company.phone,
      address: company.address,
      tagline: company.tagline,
      description: company.description,
      branches: company.branches,
      counts: company._count,
    },
  });
});

ownerRouter.get("/products", async (req, res) => {
  const products = await prisma.product.findMany({
    where: { tenantId: req.owner!.tenantId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  res.json({ ok: true, products: products.map(serializeProduct) });
});

const productUnit = z.enum(["LITER", "BOTTLE", "DRUM", "PIECE", "KG"]);

const productCreateSchema = z.object({
  name: z.string().min(2).max(120),
  nameBn: z.string().max(120).nullable().optional(),
  sku: z.string().min(2).max(64),
  category: z.string().min(2).max(64).default("water"),
  unit: productUnit.default("BOTTLE"),
  priceBdt: z.coerce.number().nonnegative(),
  stockQty: z.coerce.number().nonnegative().default(0),
  minStock: z.coerce.number().nonnegative().default(0),
  description: z.string().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
});

ownerRouter.post("/products", requireOwner, async (req, res) => {
  const parsed = productCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: parsed.error.message });
    return;
  }

  try {
    const product = await prisma.product.create({
      data: {
        tenantId: req.owner!.tenantId,
        name: parsed.data.name,
        nameBn: parsed.data.nameBn ?? null,
        sku: parsed.data.sku,
        category: parsed.data.category,
        unit: parsed.data.unit,
        priceBdt: parsed.data.priceBdt,
        stockQty: parsed.data.stockQty,
        minStock: parsed.data.minStock,
        description: parsed.data.description ?? null,
        isActive: parsed.data.isActive ?? true,
      },
    });
    res.status(201).json({ ok: true, product: serializeProduct(product) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "create failed";
    res.status(400).json({ ok: false, message });
  }
});

const productUpdateSchema = productCreateSchema.partial();

ownerRouter.patch("/products/:id", requireOwner, async (req, res) => {
  const parsed = productUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: parsed.error.message });
    return;
  }

  const id = String(req.params.id);
  const existing = await prisma.product.findFirst({
    where: { id, tenantId: req.owner!.tenantId },
  });
  if (!existing) {
    res.status(404).json({ ok: false, message: "Product not found" });
    return;
  }

  const product = await prisma.product.update({
    where: { id: existing.id },
    data: parsed.data,
  });

  res.json({ ok: true, product: serializeProduct(product) });
});

ownerRouter.delete("/products/:id", requireOwner, async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.product.findFirst({
    where: { id, tenantId: req.owner!.tenantId },
  });
  if (!existing) {
    res.status(404).json({ ok: false, message: "Product not found" });
    return;
  }

  // Soft delete — keep history for later inventory/orders
  const product = await prisma.product.update({
    where: { id: existing.id },
    data: { isActive: false },
  });

  res.json({ ok: true, product: serializeProduct(product) });
});

ownerRouter.get("/buyers", async (req, res) => {
  const buyers = await prisma.buyer.findMany({
    where: { tenantId: req.owner!.tenantId, isActive: true },
    orderBy: { shopName: "asc" },
  });
  res.json({ ok: true, buyers });
});

function serializeProduct(product: {
  id: string;
  tenantId: string;
  name: string;
  nameBn: string | null;
  sku: string;
  category: string;
  unit: string;
  priceBdt: { toString(): string } | number | string;
  stockQty: { toString(): string } | number | string;
  minStock: { toString(): string } | number | string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: product.id,
    tenantId: product.tenantId,
    name: product.name,
    nameBn: product.nameBn,
    sku: product.sku,
    category: product.category,
    unit: product.unit,
    priceBdt: Number(product.priceBdt),
    stockQty: Number(product.stockQty),
    minStock: Number(product.minStock),
    description: product.description,
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
