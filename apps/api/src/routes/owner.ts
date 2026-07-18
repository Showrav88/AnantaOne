import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import {
  requireCompanyStaff,
  requireOwnerOnly,
  requireOwnerOrManager,
} from "../middleware/companyAccess.js";
import { branchFilter, resolveBranchScope } from "../lib/branchScope.js";
import { buildAutoSku } from "../lib/shortCodes.js";

export const ownerRouter = Router();

ownerRouter.use(requireAuth, requireCompanyStaff);

function tenantId(req: { auth?: { tenantId: string | null } }) {
  return req.auth!.tenantId!;
}

ownerRouter.get("/dashboard", async (req, res) => {
  const tid = tenantId(req);
  const scope = resolveBranchScope(req);
  const orderBranch = branchFilter(scope);
  const isOwner = req.auth!.roleCode === "OWNER";

  const [company, productCount, buyerCount, lowStock, recentProducts, wallet, branchOrderCount] =
    await Promise.all([
      prisma.company.findUniqueOrThrow({
        where: { id: tid },
        include: {
          branches: {
            where:
              isOwner || !scope.branchId
                ? undefined
                : { id: scope.branchId },
            orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
            take: isOwner ? 5 : 1,
          },
          _count: { select: { users: true, buyers: true, products: true } },
        },
      }),
      prisma.product.count({ where: { tenantId: tid, isActive: true } }),
      prisma.buyer.count({ where: { tenantId: tid, isActive: true } }),
      prisma.product.findMany({
        where: { tenantId: tid, isActive: true },
        include: { unit: true },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      prisma.product.findMany({
        where: { tenantId: tid },
        include: { unit: true },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
      isOwner
        ? prisma.cashWallet.findUnique({ where: { tenantId: tid } })
        : Promise.resolve(null),
      prisma.salesOrder.count({
        where: {
          tenantId: tid,
          ...orderBranch,
          status: { code: { notIn: ["CANCELLED", "REVERSED"] } },
        },
      }),
    ]);

  const lowStockItems = lowStock
    .filter((p) => Number(p.stockQty) <= Number(p.minStock))
    .slice(0, 8)
    .map(serializeProduct);

  const staffCount = isOwner
    ? company._count.users
    : await prisma.user.count({
        where: {
          tenantId: tid,
          ...(scope.branchId ? { branchId: scope.branchId } : { id: "__none__" }),
          role: { code: { in: ["MANAGER", "EMPLOYEE"] } },
        },
      });

  res.json({
    ok: true,
    role: req.auth!.roleCode,
    branchScope: {
      mode: scope.mode,
      branchId: scope.branchId,
      assignedBranchId: scope.assignedBranchId,
    },
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
        logoUrl: company.logoUrl,
        brandPrimary: company.brandPrimary,
        brandAccent: company.brandAccent,
        brandFont: company.brandFont,
        branches: company.branches,
        counts: company._count,
      },
      stats: {
        products: productCount,
        buyers: isOwner ? buyerCount : undefined,
        lowStock: isOwner ? lowStockItems.length : undefined,
        users: staffCount,
        cashBalanceBdt: wallet ? Number(wallet.balanceBdt) : undefined,
        branchOrders: branchOrderCount,
      },
      lowStock: isOwner ? lowStockItems : [],
      recentProducts: isOwner
        ? recentProducts.map(serializeProduct)
        : recentProducts.slice(0, 3).map(serializeProduct),
    },
  });
});

function serializeCompany(company: {
  id: string;
  name: string;
  slug: string;
  locale: string;
  phone: string | null;
  address: string | null;
  divisionId: string | null;
  districtId: string | null;
  upazilaId: string | null;
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  heroVideoUrl: string | null;
  brandPrimary: string | null;
  brandAccent: string | null;
  brandBg: string | null;
  brandFont: string | null;
  siteHeadline: string | null;
  siteSubhead: string | null;
  branches: Array<{
    id: string;
    name: string;
    address: string | null;
    phone?: string | null;
    isActive?: boolean;
    managerId?: string | null;
  }>;
  _count: { users: number; buyers: number; products: number };
  division?: { id: string; code: string; name: string; nameBn: string | null } | null;
  district?: { id: string; code: string; name: string; nameBn: string | null } | null;
  upazila?: { id: string; code: string; name: string; nameBn: string | null } | null;
}) {
  return {
    id: company.id,
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
          code: company.division.code,
          name: company.division.name,
          nameBn: company.division.nameBn,
        }
      : null,
    district: company.district
      ? {
          id: company.district.id,
          code: company.district.code,
          name: company.district.name,
          nameBn: company.district.nameBn,
        }
      : null,
    upazila: company.upazila
      ? {
          id: company.upazila.id,
          code: company.upazila.code,
          name: company.upazila.name,
          nameBn: company.upazila.nameBn,
        }
      : null,
    tagline: company.tagline,
    description: company.description,
    logoUrl: company.logoUrl,
    heroImageUrl: company.heroImageUrl,
    heroVideoUrl: company.heroVideoUrl,
    brandPrimary: company.brandPrimary,
    brandAccent: company.brandAccent,
    brandBg: company.brandBg,
    brandFont: company.brandFont,
    siteHeadline: company.siteHeadline,
    siteSubhead: company.siteSubhead,
    branches: company.branches,
    counts: company._count,
  };
}

const companyInclude = {
  branches: {
    orderBy: [{ isActive: "desc" as const }, { createdAt: "asc" as const }],
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      isActive: true,
      managerId: true,
    },
  },
  division: true,
  district: true,
  upazila: true,
  _count: { select: { users: true, buyers: true, products: true } },
};

ownerRouter.get("/company", async (req, res) => {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: tenantId(req) },
    include: companyInclude,
  });

  res.json({
    ok: true,
    role: req.auth!.roleCode,
    company: serializeCompany(company),
  });
});

const companyUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(32).nullable().optional(),
  address: z.string().max(240).nullable().optional(),
  divisionId: z.string().cuid().nullable().optional(),
  districtId: z.string().cuid().nullable().optional(),
  upazilaId: z.string().cuid().nullable().optional(),
  setupDeliveryAreas: z.boolean().optional(),
  wardCount: z.coerce.number().int().min(1).max(50).optional(),
  freeWardCount: z.coerce.number().int().min(0).max(50).optional(),
  tagline: z.string().max(160).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  locale: z.enum(["bn", "en"]).optional(),
});

ownerRouter.patch("/company", requireOwnerOnly, async (req, res) => {
  const parsed = companyUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: parsed.error.message });
    return;
  }

  const {
    setupDeliveryAreas,
    wardCount,
    freeWardCount,
    ...data
  } = parsed.data;

  if (data.districtId) {
    const dist = await prisma.bdDistrict.findUnique({
      where: { id: data.districtId },
    });
    if (!dist) {
      res.status(400).json({ ok: false, message: "Invalid district" });
      return;
    }
    if (data.divisionId && data.divisionId !== dist.divisionId) {
      res.status(400).json({ ok: false, message: "District/division mismatch" });
      return;
    }
    data.divisionId = dist.divisionId;
  }
  if (data.upazilaId) {
    const upa = await prisma.bdUpazila.findUnique({
      where: { id: data.upazilaId },
    });
    if (!upa) {
      res.status(400).json({ ok: false, message: "Invalid upazila" });
      return;
    }
    if (data.districtId && data.districtId !== upa.districtId) {
      res.status(400).json({ ok: false, message: "Upazila/district mismatch" });
      return;
    }
    data.districtId = upa.districtId;
    const dist = await prisma.bdDistrict.findUniqueOrThrow({
      where: { id: upa.districtId },
    });
    data.divisionId = dist.divisionId;
  }

  const company = await prisma.company.update({
    where: { id: tenantId(req) },
    data,
    include: companyInclude,
  });

  let wardsSeeded = 0;
  if (
    setupDeliveryAreas &&
    company.districtId &&
    company.upazilaId
  ) {
    const { seedWardsForCompanyLocation } = await import("../lib/bdGeo.js");
    const wards = await seedWardsForCompanyLocation({
      tenantId: company.id,
      districtId: company.districtId,
      upazilaId: company.upazilaId,
      wardCount,
      freeWardCount,
    });
    wardsSeeded = wards.length;
  }

  res.json({
    ok: true,
    wardsSeeded,
    company: serializeCompany(company),
  });
});

ownerRouter.get("/products", async (req, res) => {
  const products = await prisma.product.findMany({
    where: { tenantId: tenantId(req) },
    include: { unit: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  res.json({ ok: true, products: products.map(serializeProduct) });
});

const productCreateSchema = z.object({
  name: z.string().min(2).max(120),
  nameBn: z.string().max(120).nullable().optional(),
  /** Optional — blank / omitted generates a short ordered SKU (e.g. D001). */
  sku: z.string().max(64).optional(),
  category: z.string().min(2).max(64).default("water"),
  unitCode: z.string().min(2).max(32).default("BOTTLE"),
  size: z.coerce.number().positive().nullable().optional(),
  priceBdt: z.coerce.number().nonnegative(),
  stockQty: z.coerce.number().nonnegative().default(0),
  minStock: z.coerce.number().nonnegative().default(0),
  description: z.string().max(1000).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  imagePublicId: z.string().max(240).nullable().optional(),
  isActive: z.boolean().optional(),
});

async function nextAutoSku(tenantId: string, category: string) {
  const count = await prisma.product.count({ where: { tenantId } });
  let seq = count + 1;
  for (let i = 0; i < 5000; i += 1) {
    const sku = buildAutoSku(category, seq);
    const exists = await prisma.product.findFirst({
      where: { tenantId, sku },
      select: { id: true },
    });
    if (!exists) return sku;
    seq += 1;
  }
  throw new Error("Could not allocate SKU");
}

ownerRouter.get("/products/next-sku", requireOwnerOrManager, async (req, res) => {
  const category = String(req.query.category ?? "DRINKING");
  try {
    const sku = await nextAutoSku(tenantId(req), category);
    res.json({ ok: true, sku });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed",
    });
  }
});

ownerRouter.post("/products", requireOwnerOnly, async (req, res) => {
  const parsed = productCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: parsed.error.message });
    return;
  }

  const unit = await prisma.unitLookup.findUnique({
    where: { code: parsed.data.unitCode },
  });
  if (!unit) {
    res.status(400).json({ ok: false, message: "Unknown unitCode" });
    return;
  }

  try {
    const tid = tenantId(req);
    const manual = parsed.data.sku?.trim();
    const sku =
      manual && manual.length >= 2
        ? manual.toUpperCase()
        : await nextAutoSku(tid, parsed.data.category);

    const product = await prisma.product.create({
      data: {
        tenantId: tid,
        name: parsed.data.name,
        nameBn: parsed.data.nameBn ?? null,
        sku,
        category: parsed.data.category,
        unitId: unit.id,
        size: parsed.data.size ?? null,
        priceBdt: parsed.data.priceBdt,
        stockQty: parsed.data.stockQty,
        minStock: parsed.data.minStock,
        description: parsed.data.description ?? null,
        imageUrl: parsed.data.imageUrl ?? null,
        imagePublicId: parsed.data.imagePublicId ?? null,
        isActive: parsed.data.isActive ?? true,
        createdBy: req.auth!.id,
      },
      include: { unit: true },
    });
    res.status(201).json({ ok: true, product: serializeProduct(product) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "create failed";
    res.status(400).json({ ok: false, message });
  }
});

const productUpdateSchema = productCreateSchema.partial();

ownerRouter.patch("/products/:id", requireOwnerOnly, async (req, res) => {
  const parsed = productUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: parsed.error.message });
    return;
  }

  const id = String(req.params.id);
  const existing = await prisma.product.findFirst({
    where: { id, tenantId: tenantId(req) },
  });
  if (!existing) {
    res.status(404).json({ ok: false, message: "Product not found" });
    return;
  }

  let unitId: string | undefined;
  if (parsed.data.unitCode) {
    const unit = await prisma.unitLookup.findUnique({
      where: { code: parsed.data.unitCode },
    });
    if (!unit) {
      res.status(400).json({ ok: false, message: "Unknown unitCode" });
      return;
    }
    unitId = unit.id;
  }

  const { unitCode: _unitCode, sku: skuRaw, ...rest } = parsed.data;
  const sku =
    skuRaw != null && skuRaw.trim().length >= 2
      ? skuRaw.trim().toUpperCase()
      : undefined;
  const product = await prisma.product.update({
    where: { id: existing.id },
    data: {
      ...rest,
      ...(sku ? { sku } : {}),
      ...(unitId ? { unitId } : {}),
      updatedBy: req.auth!.id,
    },
    include: { unit: true },
  });

  res.json({ ok: true, product: serializeProduct(product) });
});

ownerRouter.delete("/products/:id", requireOwnerOnly, async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.product.findFirst({
    where: { id, tenantId: tenantId(req) },
  });
  if (!existing) {
    res.status(404).json({ ok: false, message: "Product not found" });
    return;
  }

  const product = await prisma.product.update({
    where: { id: existing.id },
    data: { isActive: false, updatedBy: req.auth!.id },
    include: { unit: true },
  });

  res.json({ ok: true, product: serializeProduct(product) });
});

/** Owner can add a custom unit (EN + BN) for the catalog dropdown. */
ownerRouter.post("/units", requireOwnerOnly, async (req, res) => {
  const parsed = z
    .object({
      code: z
        .string()
        .min(2)
        .max(32)
        .regex(/^[A-Z][A-Z0-9_]*$/i, "Use letters/numbers/underscore"),
      nameEn: z.string().min(1).max(64),
      nameBn: z.string().min(1).max(64),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: parsed.error.message });
    return;
  }
  const code = parsed.data.code.trim().toUpperCase();
  try {
    const unit = await prisma.unitLookup.upsert({
      where: { code },
      create: {
        code,
        nameEn: parsed.data.nameEn.trim(),
        nameBn: parsed.data.nameBn.trim(),
        sortOrder: 100,
      },
      update: {
        nameEn: parsed.data.nameEn.trim(),
        nameBn: parsed.data.nameBn.trim(),
        isActive: true,
      },
    });
    res.status(201).json({ ok: true, unit });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error instanceof Error ? error.message : "Failed",
    });
  }
});

/* Buyers CRUD + analytics live on ownerCommerceRouter */

function serializeProduct(product: {
  id: string;
  tenantId: string;
  name: string;
  nameBn: string | null;
  sku: string;
  category: string;
  unitId: string;
  size?: { toString(): string } | number | string | null;
  unit?: { code: string; nameEn: string; nameBn: string };
  priceBdt: { toString(): string } | number | string;
  stockQty: { toString(): string } | number | string;
  minStock: { toString(): string } | number | string;
  description: string | null;
  imageUrl?: string | null;
  imagePublicId?: string | null;
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
    unitId: product.unitId,
    size: product.size == null ? null : Number(product.size),
    unit: product.unit?.code ?? null,
    unitLabel: product.unit
      ? { en: product.unit.nameEn, bn: product.unit.nameBn }
      : null,
    priceBdt: Number(product.priceBdt),
    stockQty: Number(product.stockQty),
    minStock: Number(product.minStock),
    description: product.description,
    imageUrl: product.imageUrl ?? null,
    imagePublicId: product.imagePublicId ?? null,
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
