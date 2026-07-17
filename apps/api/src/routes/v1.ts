import { Router } from "express";
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
        isActive: p.isActive,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(500).json({ ok: false, message, products: [] });
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
        },
        product: {
          name: product.name,
          nameBn: product.nameBn,
          sku: product.sku,
          unit: product.unit.code,
          priceBdt: Number(product.priceBdt),
          description: product.description,
        },
        batch: {
          batchCode: batch.batchCode,
          manufacturedAt: batch.manufacturedAt,
          expiresAt: batch.expiresAt,
          qtyRemaining: Number(batch.qtyRemaining),
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(500).json({ ok: false, message });
  }
});
