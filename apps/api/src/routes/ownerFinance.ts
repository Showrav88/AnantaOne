import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { hashPassword } from "../lib/auth.js";
import {
  editManualDebitTxn,
  ensureCashWallet,
  recordWalletTxn,
  serializeTxn,
} from "../lib/wallet.js";
import { requireAuth } from "../middleware/auth.js";
import {
  requireCompanyStaff,
  requireOwnerOnly,
  requireOwnerOrManager,
} from "../middleware/companyAccess.js";
import { resolveBranchScope } from "../lib/branchScope.js";

export const ownerFinanceRouter = Router();

ownerFinanceRouter.use(requireAuth, requireCompanyStaff);

function tid(req: { auth?: { tenantId: string | null } }) {
  return req.auth!.tenantId!;
}

function serializeStaff(user: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  employeeCode: string | null;
  designation: string | null;
  joiningDate: Date | null;
  salaryBdt: { toString(): string } | number | string | null;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  isActive: boolean;
  createdAt: Date;
  branchId?: string | null;
  branch?: { id: string; name: string } | null;
  role: { code: string; nameEn: string; nameBn: string };
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    employeeCode: user.employeeCode,
    designation: user.designation,
    joiningDate: user.joiningDate,
    salaryBdt: user.salaryBdt == null ? null : Number(user.salaryBdt),
    imageUrl: user.imageUrl ?? null,
    imagePublicId: user.imagePublicId ?? null,
    isActive: user.isActive,
    createdAt: user.createdAt,
    branchId: user.branchId ?? null,
    branch: user.branch
      ? { id: user.branch.id, name: user.branch.name }
      : null,
    role: {
      code: user.role.code,
      nameEn: user.role.nameEn,
      nameBn: user.role.nameBn,
    },
  };
}

/* ───────── Staff (manager / employee) ───────── */

ownerFinanceRouter.get("/staff", requireOwnerOrManager, async (req, res) => {
  const scope = resolveBranchScope(req);
  const isOwner = req.auth!.roleCode === "OWNER";
  const staff = await prisma.user.findMany({
    where: {
      tenantId: tid(req),
      role: {
        code: isOwner
          ? { in: ["MANAGER", "EMPLOYEE", "OWNER"] }
          : { in: ["MANAGER", "EMPLOYEE"] },
      },
      ...(isOwner
        ? {}
        : scope.branchId
          ? { branchId: scope.branchId }
          : { id: "__no_branch__" }),
    },
    include: { role: true, branch: { select: { id: true, name: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  res.json({ ok: true, staff: staff.map(serializeStaff) });
});

const staffCreateSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(32).nullable().optional(),
  password: z.string().min(8).max(100),
  roleCode: z.enum(["MANAGER", "EMPLOYEE"]),
  branchId: z.string().cuid().nullable().optional(),
  employeeCode: z.string().max(32).nullable().optional(),
  designation: z.string().max(120).nullable().optional(),
  joiningDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
  salaryBdt: z.coerce.number().nonnegative().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  imagePublicId: z.string().max(240).nullable().optional(),
});

ownerFinanceRouter.post("/staff", requireOwnerOnly, async (req, res) => {
  const parsed = staffCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const email = data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ ok: false, message: "Email already registered" });
    return;
  }

  const role = await prisma.roleLookup.findUnique({
    where: { code: data.roleCode },
  });
  if (!role) {
    res.status(400).json({ ok: false, message: "Unknown role" });
    return;
  }

  let branchId: string | null = null;
  if (data.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: data.branchId, tenantId: tid(req), isActive: true },
    });
    if (!branch) {
      res.status(400).json({ ok: false, message: "Branch not found" });
      return;
    }
    branchId = branch.id;
  } else if (data.branchId === undefined) {
    const branch = await prisma.branch.findFirst({
      where: { tenantId: tid(req), isActive: true },
      orderBy: { createdAt: "asc" },
    });
    branchId = branch?.id ?? null;
  }

  let joiningDate: Date | null = null;
  if (data.joiningDate) {
    joiningDate = new Date(
      data.joiningDate.length === 10
        ? `${data.joiningDate}T00:00:00.000Z`
        : data.joiningDate,
    );
  }

  try {
    const user = await prisma.user.create({
      data: {
        tenantId: tid(req),
        branchId,
        email,
        name: data.name,
        phone: data.phone ?? null,
        passwordHash: await hashPassword(data.password),
        roleId: role.id,
        employeeCode: data.employeeCode || null,
        designation: data.designation ?? null,
        joiningDate,
        salaryBdt: data.salaryBdt ?? null,
        imageUrl: data.imageUrl ?? null,
        imagePublicId: data.imagePublicId ?? null,
        createdBy: req.auth!.id,
      },
      include: { role: true, branch: { select: { id: true, name: true } } },
    });

    if (branchId && data.roleCode === "MANAGER") {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, tenantId: tid(req) },
      });
      if (branch && !branch.managerId) {
        await prisma.branch.update({
          where: { id: branchId },
          data: { managerId: user.id },
        });
      }
    }

    res.status(201).json({ ok: true, staff: serializeStaff(user) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "create failed";
    res.status(400).json({ ok: false, message });
  }
});

const staffUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(32).nullable().optional(),
  roleCode: z.enum(["MANAGER", "EMPLOYEE"]).optional(),
  branchId: z.string().cuid().nullable().optional(),
  employeeCode: z.string().max(32).nullable().optional(),
  designation: z.string().max(120).nullable().optional(),
  joiningDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .nullable()
    .optional(),
  salaryBdt: z.coerce.number().nonnegative().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  imagePublicId: z.string().max(240).nullable().optional(),
  clearImage: z.boolean().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).max(100).optional(),
});

ownerFinanceRouter.patch("/staff/:id", requireOwnerOnly, async (req, res) => {
  const parsed = staffUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: parsed.error.message });
    return;
  }

  const id = String(req.params.id);
  const existing = await prisma.user.findFirst({
    where: { id, tenantId: tid(req) },
    include: { role: true },
  });
  if (!existing) {
    res.status(404).json({ ok: false, message: "Staff not found" });
    return;
  }
  if (existing.role.code === "OWNER") {
    res.status(400).json({ ok: false, message: "Cannot edit owner via staff API" });
    return;
  }

  let email: string | undefined;
  if (parsed.data.email) {
    email = parsed.data.email.toLowerCase().trim();
    if (email !== existing.email) {
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken) {
        res.status(409).json({ ok: false, message: "Email already registered" });
        return;
      }
    }
  }

  let roleId: string | undefined;
  if (parsed.data.roleCode) {
    const role = await prisma.roleLookup.findUnique({
      where: { code: parsed.data.roleCode },
    });
    if (!role) {
      res.status(400).json({ ok: false, message: "Unknown role" });
      return;
    }
    roleId = role.id;
  }

  let branchId: string | null | undefined = undefined;
  if (parsed.data.branchId === null) {
    branchId = null;
  } else if (parsed.data.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: parsed.data.branchId, tenantId: tid(req) },
    });
    if (!branch) {
      res.status(400).json({ ok: false, message: "Branch not found" });
      return;
    }
    branchId = branch.id;
  }

  let joiningDate: Date | null | undefined = undefined;
  if (parsed.data.joiningDate === null) joiningDate = null;
  else if (parsed.data.joiningDate) {
    joiningDate = new Date(
      parsed.data.joiningDate.length === 10
        ? `${parsed.data.joiningDate}T00:00:00.000Z`
        : parsed.data.joiningDate,
    );
  }

  const passwordHash = parsed.data.password
    ? await hashPassword(parsed.data.password)
    : undefined;

  const {
    roleCode: _r,
    password: _p,
    joiningDate: _j,
    branchId: _b,
    email: _e,
    clearImage,
    ...rest
  } = parsed.data;
  const user = await prisma.user.update({
    where: { id: existing.id },
    data: {
      ...rest,
      ...(email ? { email } : {}),
      ...(roleId ? { roleId } : {}),
      ...(branchId !== undefined ? { branchId } : {}),
      ...(joiningDate !== undefined ? { joiningDate } : {}),
      ...(passwordHash ? { passwordHash } : {}),
      ...(clearImage
        ? { imageUrl: null, imagePublicId: null }
        : {}),
      updatedBy: req.auth!.id,
    },
    include: { role: true, branch: { select: { id: true, name: true } } },
  });

  if (branchId && (parsed.data.roleCode === "MANAGER" || existing.role.code === "MANAGER")) {
    const targetBranchId = branchId;
    const branch = await prisma.branch.findFirst({
      where: { id: targetBranchId, tenantId: tid(req) },
    });
    if (branch && !branch.managerId) {
      await prisma.branch.update({
        where: { id: targetBranchId },
        data: { managerId: user.id },
      });
    }
  }

  if (branchId === null || (branchId && existing.branchId && existing.branchId !== branchId)) {
    await prisma.branch.updateMany({
      where: {
        tenantId: tid(req),
        managerId: existing.id,
        ...(branchId ? { id: { not: branchId } } : {}),
      },
      data: { managerId: null },
    });
  }

  res.json({ ok: true, staff: serializeStaff(user) });
});

ownerFinanceRouter.delete("/staff/:id", requireOwnerOnly, async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.user.findFirst({
    where: { id, tenantId: tid(req) },
    include: { role: true },
  });
  if (!existing) {
    res.status(404).json({ ok: false, message: "Staff not found" });
    return;
  }
  if (existing.role.code === "OWNER") {
    res.status(400).json({ ok: false, message: "Cannot deactivate owner" });
    return;
  }

  const user = await prisma.$transaction(async (tx) => {
    await tx.branch.updateMany({
      where: { tenantId: tid(req), managerId: existing.id },
      data: { managerId: null },
    });
    return tx.user.update({
      where: { id: existing.id },
      data: { isActive: false, updatedBy: req.auth!.id },
      include: { role: true, branch: { select: { id: true, name: true } } },
    });
  });
  res.json({ ok: true, staff: serializeStaff(user) });
});

/* ───────── Cash wallet / drawer ───────── */

ownerFinanceRouter.get("/wallet", async (req, res) => {
  const wallet = await ensureCashWallet(tid(req));
  const types = await prisma.walletTxnTypeLookup.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  const recent = await prisma.cashTransaction.findMany({
    where: { tenantId: tid(req) },
    include: { type: true },
    orderBy: { occurredAt: "desc" },
    take: 40,
  });

  res.json({
    ok: true,
    wallet: {
      id: wallet.id,
      balanceBdt: Number(wallet.balanceBdt),
      updatedAt: wallet.updatedAt,
    },
    types: types.map((t) => ({
      code: t.code,
      nameEn: t.nameEn,
      nameBn: t.nameBn,
      direction: t.direction,
    })),
    transactions: recent.map(serializeTxn),
  });
});

ownerFinanceRouter.get("/wallet/transactions", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 300);
  const txns = await prisma.cashTransaction.findMany({
    where: { tenantId: tid(req) },
    include: { type: true },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
  res.json({ ok: true, transactions: txns.map(serializeTxn) });
});

const adjustSchema = z.object({
  typeCode: z.enum([
    "OPENING",
    "ADJUSTMENT_IN",
    "ADJUSTMENT_OUT",
    "OTHER_IN",
    "OTHER_OUT",
  ]),
  amountBdt: z.coerce.number().positive(),
  note: z.string().max(500).nullable().optional(),
  occurredAt: z.string().datetime().optional(),
});

ownerFinanceRouter.post(
  "/wallet/adjust",
  requireOwnerOnly,
  async (req, res) => {
    const parsed = adjustSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }
    try {
      const result = await recordWalletTxn({
        tenantId: tid(req),
        typeCode: parsed.data.typeCode,
        amountBdt: parsed.data.amountBdt,
        note: parsed.data.note,
        occurredAt: parsed.data.occurredAt
          ? new Date(parsed.data.occurredAt)
          : undefined,
        createdBy: req.auth!.id,
      });
      res.status(201).json({
        ok: true,
        wallet: {
          id: result.wallet.id,
          balanceBdt: Number(result.wallet.balanceBdt),
        },
        transaction: serializeTxn(result.transaction),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed";
      res.status(400).json({ ok: false, message });
    }
  },
);

const saleSchema = z.object({
  amountBdt: z.coerce.number().positive(),
  buyerId: z.string().nullable().optional(),
  buyerName: z.string().max(160).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  soldAt: z.string().datetime().optional(),
});

ownerFinanceRouter.post(
  "/wallet/sales",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }
    try {
      const soldAt = parsed.data.soldAt
        ? new Date(parsed.data.soldAt)
        : new Date();
      const result = await recordWalletTxn({
        tenantId: tid(req),
        typeCode: "SALE",
        amountBdt: parsed.data.amountBdt,
        note: parsed.data.note,
        occurredAt: soldAt,
        createdBy: req.auth!.id,
      });
      const sale = await prisma.sale.create({
        data: {
          tenantId: tid(req),
          buyerId: parsed.data.buyerId ?? null,
          buyerName: parsed.data.buyerName ?? null,
          amountBdt: parsed.data.amountBdt,
          note: parsed.data.note ?? null,
          soldAt,
          cashTransactionId: result.transaction.id,
          createdBy: req.auth!.id,
        },
      });
      res.status(201).json({
        ok: true,
        sale: {
          id: sale.id,
          amountBdt: Number(sale.amountBdt),
          buyerName: sale.buyerName,
          soldAt: sale.soldAt,
        },
        wallet: {
          id: result.wallet.id,
          balanceBdt: Number(result.wallet.balanceBdt),
        },
        transaction: serializeTxn(result.transaction),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed";
      res.status(400).json({ ok: false, message });
    }
  },
);

const materialSchema = z
  .object({
    materialId: z.string().cuid().optional(),
    materialName: z.string().min(2).max(160).optional(),
    kindCode: z
      .enum([
        "RAW_MATERIAL",
        "BOTTLE",
        "ACID",
        "CAP",
        "LABEL",
        "OTHER",
      ])
      .default("OTHER"),
    unitCode: z
      .enum(["LITER", "BOTTLE", "DRUM", "PIECE", "KG", "PACK", "CAN"])
      .default("PIECE"),
    qty: z.coerce.number().positive(),
    goodsAmountBdt: z.coerce.number().nonnegative(),
    transportBdt: z.coerce.number().nonnegative().optional(),
    driverBdt: z.coerce.number().nonnegative().optional(),
    travelBdt: z.coerce.number().nonnegative().optional(),
    /** @deprecated prefer goodsAmountBdt + extras; kept for older clients */
    amountBdt: z.coerce.number().positive().optional(),
    supplierName: z.string().max(160).nullable().optional(),
    supplierPhone: z.string().max(40).nullable().optional(),
    note: z.string().max(500).nullable().optional(),
    purchasedAt: z.string().datetime().optional(),
  })
  .refine(
    (d) => d.materialId || (d.materialName && d.materialName.trim().length >= 2),
    { message: "Material name or catalog item required" },
  );

async function resolvePurchaseMaterial(opts: {
  tenantId: string;
  materialId?: string;
  materialName?: string;
  kindCode: string;
  unitCode: string;
}) {
  if (opts.materialId) {
    const catalog = await prisma.material.findFirst({
      where: {
        id: opts.materialId,
        tenantId: opts.tenantId,
        isActive: true,
      },
      include: { kind: true, unit: true },
    });
    if (!catalog) {
      throw new Error("Material not found in catalog");
    }
    return {
      materialId: catalog.id,
      materialName: opts.materialName?.trim() || catalog.name,
      kind: catalog.kind,
      unit: catalog.unit,
    };
  }
  const kind = await prisma.supplyKindLookup.findUnique({
    where: { code: opts.kindCode },
  });
  const unit = await prisma.unitLookup.findUnique({
    where: { code: opts.unitCode },
  });
  if (!kind?.isActive || !unit?.isActive) {
    throw new Error("Unknown supply kind or unit");
  }
  return {
    materialId: null as string | null,
    materialName: opts.materialName!.trim(),
    kind,
    unit,
  };
}

function serializePurchase(p: {
  id: string;
  materialName: string;
  materialId?: string | null;
  supplierName: string | null;
  supplierPhone: string | null;
  qty: { toString(): string } | number;
  goodsAmountBdt: { toString(): string } | number;
  transportBdt: { toString(): string } | number;
  driverBdt: { toString(): string } | number;
  travelBdt: { toString(): string } | number;
  amountBdt: { toString(): string } | number;
  purchasedAt: Date;
  note: string | null;
  reversedAt?: Date | null;
  reverseReason?: string | null;
  kind?: { code: string; nameEn: string; nameBn: string };
  unit?: { code: string; nameEn: string; nameBn: string };
  catalogMaterial?: {
    id: string;
    name: string;
    code: string | null;
  } | null;
}) {
  const qty = Number(p.qty);
  const goods = Number(p.goodsAmountBdt);
  const transport = Number(p.transportBdt);
  const driver = Number(p.driverBdt);
  const travel = Number(p.travelBdt);
  const total = Number(p.amountBdt);
  return {
    id: p.id,
    materialId: p.materialId ?? p.catalogMaterial?.id ?? null,
    materialName: p.materialName,
    catalogMaterial: p.catalogMaterial
      ? {
          id: p.catalogMaterial.id,
          name: p.catalogMaterial.name,
          code: p.catalogMaterial.code,
        }
      : null,
    supplierName: p.supplierName,
    supplierPhone: p.supplierPhone,
    qty,
    goodsAmountBdt: goods,
    transportBdt: transport,
    driverBdt: driver,
    travelBdt: travel,
    amountBdt: total,
    landedUnitCostBdt: qty > 0 ? total / qty : null,
    purchasedAt: p.purchasedAt,
    note: p.note,
    isReversed: Boolean(p.reversedAt),
    reverseReason: p.reverseReason ?? null,
    reversedAt: p.reversedAt ?? null,
    kind: p.kind
      ? { code: p.kind.code, nameEn: p.kind.nameEn, nameBn: p.kind.nameBn }
      : null,
    unit: p.unit
      ? { code: p.unit.code, nameEn: p.unit.nameEn, nameBn: p.unit.nameBn }
      : null,
    breakdown: {
      goodsBdt: goods,
      transportBdt: transport,
      driverBdt: driver,
      travelBdt: travel,
      totalBdt: total,
    },
  };
}

function resolvePurchaseTotals(data: {
  goodsAmountBdt: number;
  transportBdt?: number;
  driverBdt?: number;
  travelBdt?: number;
  amountBdt?: number;
}) {
  const transportBdt = data.transportBdt ?? 0;
  const driverBdt = data.driverBdt ?? 0;
  const travelBdt = data.travelBdt ?? 0;
  const goodsAmountBdt =
    data.goodsAmountBdt > 0 ? data.goodsAmountBdt : (data.amountBdt ?? 0);
  const totalBdt = goodsAmountBdt + transportBdt + driverBdt + travelBdt;
  return { goodsAmountBdt, transportBdt, driverBdt, travelBdt, totalBdt };
}

ownerFinanceRouter.get("/wallet/supply-meta", async (_req, res) => {
  const [kinds, units] = await Promise.all([
    prisma.supplyKindLookup.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.unitLookup.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  res.json({
    ok: true,
    kinds: kinds.map((k) => ({
      code: k.code,
      nameEn: k.nameEn,
      nameBn: k.nameBn,
      description: k.description,
    })),
    units: units.map((u) => ({
      code: u.code,
      nameEn: u.nameEn,
      nameBn: u.nameBn,
    })),
  });
});

ownerFinanceRouter.get("/wallet/purchases", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const purchases = await prisma.materialPurchase.findMany({
    where: { tenantId: tid(req) },
    include: { kind: true, unit: true, catalogMaterial: true },
    orderBy: { purchasedAt: "desc" },
    take: limit,
  });
  res.json({
    ok: true,
    purchases: purchases.map(serializePurchase),
  });
});

ownerFinanceRouter.post(
  "/wallet/materials",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = materialSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }
    try {
      const resolved = await resolvePurchaseMaterial({
        tenantId: tid(req),
        materialId: parsed.data.materialId,
        materialName: parsed.data.materialName,
        kindCode: parsed.data.kindCode,
        unitCode: parsed.data.unitCode,
      });
      const { kind, unit } = resolved;

      const {
        goodsAmountBdt,
        transportBdt,
        driverBdt,
        travelBdt,
        totalBdt,
      } = resolvePurchaseTotals(parsed.data);
      if (!(totalBdt > 0)) {
        res.status(400).json({
          ok: false,
          message: "Total purchase amount must be greater than zero",
        });
        return;
      }

      const purchasedAt = parsed.data.purchasedAt
        ? new Date(parsed.data.purchasedAt)
        : new Date();
      const supplierBits = [
        parsed.data.supplierName,
        parsed.data.supplierPhone,
      ]
        .filter(Boolean)
        .join(" · ");
      const qtyLabel = `${parsed.data.qty} ${unit.code}`;
      const note =
        parsed.data.note ??
        `${resolved.materialName} (${kind.code} · ${qtyLabel})${supplierBits ? ` — ${supplierBits}` : ""} · goods ৳${goodsAmountBdt}` +
          (transportBdt || driverBdt || travelBdt
            ? ` + trip ৳${transportBdt + driverBdt + travelBdt}`
            : "");

      const result = await recordWalletTxn({
        tenantId: tid(req),
        typeCode: "MATERIAL_BUY",
        amountBdt: totalBdt,
        note,
        occurredAt: purchasedAt,
        createdBy: req.auth!.id,
      });
      const purchase = await prisma.materialPurchase.create({
        data: {
          tenantId: tid(req),
          materialId: resolved.materialId,
          materialName: resolved.materialName,
          kindId: kind.id,
          unitId: unit.id,
          qty: parsed.data.qty,
          goodsAmountBdt,
          transportBdt,
          driverBdt,
          travelBdt,
          supplierName: parsed.data.supplierName ?? null,
          supplierPhone: parsed.data.supplierPhone ?? null,
          amountBdt: totalBdt,
          note: parsed.data.note ?? null,
          purchasedAt,
          cashTransactionId: result.transaction.id,
          createdBy: req.auth!.id,
        },
        include: { kind: true, unit: true, catalogMaterial: true },
      });
      res.status(201).json({
        ok: true,
        purchase: serializePurchase(purchase),
        wallet: {
          id: result.wallet.id,
          balanceBdt: Number(result.wallet.balanceBdt),
        },
        transaction: serializeTxn(result.transaction),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed";
      res.status(400).json({ ok: false, message });
    }
  },
);

ownerFinanceRouter.patch(
  "/wallet/materials/:id",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = materialSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }

    const existing = await prisma.materialPurchase.findFirst({
      where: { id: String(req.params.id), tenantId: tid(req) },
      include: { kind: true, unit: true },
    });
    if (!existing) {
      res.status(404).json({ ok: false, message: "Purchase not found" });
      return;
    }
    if (existing.reversedAt) {
      res.status(400).json({
        ok: false,
        message: "Reversed purchase cannot be edited",
      });
      return;
    }

    try {
      const resolved = await resolvePurchaseMaterial({
        tenantId: tid(req),
        materialId: parsed.data.materialId,
        materialName: parsed.data.materialName,
        kindCode: parsed.data.kindCode,
        unitCode: parsed.data.unitCode,
      });
      const { kind, unit } = resolved;

      const {
        goodsAmountBdt,
        transportBdt,
        driverBdt,
        travelBdt,
        totalBdt,
      } = resolvePurchaseTotals(parsed.data);
      if (!(totalBdt > 0)) {
        res.status(400).json({
          ok: false,
          message: "Total purchase amount must be greater than zero",
        });
        return;
      }

      const oldTotal = Number(existing.amountBdt);
      const purchasedAt = parsed.data.purchasedAt
        ? new Date(parsed.data.purchasedAt)
        : existing.purchasedAt;
      const supplierBits = [
        parsed.data.supplierName,
        parsed.data.supplierPhone,
      ]
        .filter(Boolean)
        .join(" · ");
      const qtyLabel = `${parsed.data.qty} ${unit.code}`;
      const ledgerNote =
        parsed.data.note ??
        `${resolved.materialName} (${kind.code} · ${qtyLabel})${supplierBits ? ` — ${supplierBits}` : ""} · goods ৳${goodsAmountBdt}` +
          (transportBdt || driverBdt || travelBdt
            ? ` + trip ৳${transportBdt + driverBdt + travelBdt}`
            : "");

      const result = await prisma.$transaction(async (tx) => {
        const walletEdit = await editManualDebitTxn({
          tenantId: tid(req),
          cashTransactionId: existing.cashTransactionId,
          newAmountBdt: totalBdt,
          note: ledgerNote,
          typeCode: "MATERIAL_BUY",
          occurredAt: purchasedAt,
          updatedBy: req.auth!.id,
          tx,
        });

        const purchase = await tx.materialPurchase.update({
          where: { id: existing.id },
          data: {
            materialId: resolved.materialId,
            materialName: resolved.materialName,
            kindId: kind.id,
            unitId: unit.id,
            qty: parsed.data.qty,
            goodsAmountBdt,
            transportBdt,
            driverBdt,
            travelBdt,
            supplierName: parsed.data.supplierName ?? null,
            supplierPhone: parsed.data.supplierPhone ?? null,
            amountBdt: totalBdt,
            note: parsed.data.note ?? null,
            purchasedAt,
            updatedBy: req.auth!.id,
          },
          include: { kind: true, unit: true, catalogMaterial: true },
        });

        return {
          purchase,
          wallet: walletEdit.wallet,
          walletDeltaBdt: walletEdit.walletDeltaBdt,
          oldTotal,
        };
      });

      res.json({
        ok: true,
        purchase: serializePurchase(result.purchase),
        walletDeltaBdt: result.walletDeltaBdt,
        wallet: {
          id: result.wallet.id,
          balanceBdt: Number(result.wallet.balanceBdt),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed";
      res.status(400).json({ ok: false, message });
    }
  },
);

const reverseMaterialSchema = z.object({
  reason: z.string().min(5).max(500),
});

ownerFinanceRouter.post(
  "/wallet/materials/:id/reverse",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = reverseMaterialSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        message: "Clear reverse reason required (min 5 characters)",
      });
      return;
    }

    const purchase = await prisma.materialPurchase.findFirst({
      where: { id: String(req.params.id), tenantId: tid(req) },
      include: { kind: true, unit: true },
    });
    if (!purchase) {
      res.status(404).json({ ok: false, message: "Purchase not found" });
      return;
    }
    if (purchase.reversedAt) {
      res.status(400).json({
        ok: false,
        message: "Purchase already reversed",
      });
      return;
    }

    const reason = parsed.data.reason.trim();
    const amountBdt = Number(purchase.amountBdt);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const walletResult = await recordWalletTxn({
          tenantId: tid(req),
          typeCode: "MATERIAL_REVERSE",
          amountBdt,
          note: `Supply reverse — ${purchase.materialName}: ${reason}`,
          reference: purchase.id,
          createdBy: req.auth!.id,
          tx,
        });
        const updated = await tx.materialPurchase.update({
          where: { id: purchase.id },
          data: {
            reverseReason: reason,
            reversedAt: new Date(),
            reversedBy: req.auth!.id,
            reverseCashTransactionId: walletResult.transaction.id,
            updatedBy: req.auth!.id,
          },
          include: { kind: true, unit: true },
        });
        return { updated, walletResult };
      });

      res.json({
        ok: true,
        purchase: serializePurchase(result.updated),
        cashCreditedBdt: amountBdt,
        wallet: {
          id: result.walletResult.wallet.id,
          balanceBdt: Number(result.walletResult.wallet.balanceBdt),
        },
        transaction: serializeTxn(result.walletResult.transaction),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Material reverse failed";
      res.status(400).json({ ok: false, message });
    }
  },
);

const expenseSchema = z.object({
  categoryCode: z.enum([
    "UTILITY",
    "FAMILY",
    "LAWSUIT",
    "GESTURE",
    "OTHER",
    "TRANSPORT",
    "DRIVER",
    "TRAVEL",
  ]),
  title: z.string().min(2).max(160),
  amountBdt: z.coerce.number().positive(),
  contactName: z.string().max(160).nullable().optional(),
  contactPhone: z.string().max(40).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  occurredAt: z.string().datetime().optional(),
});

function expenseWalletTypeCode(categoryCode: string) {
  if (categoryCode === "UTILITY") return "UTILITY";
  if (categoryCode === "TRANSPORT") return "TRANSPORT";
  return "EXPENSE";
}

function serializeExpense(expense: {
  id: string;
  title: string;
  amountBdt: { toString(): string } | number | string;
  contactName: string | null;
  contactPhone: string | null;
  note: string | null;
  occurredAt: Date;
  category: { code: string; nameEn: string; nameBn: string };
}) {
  return {
    id: expense.id,
    title: expense.title,
    amountBdt: Number(expense.amountBdt),
    contactName: expense.contactName,
    contactPhone: expense.contactPhone,
    note: expense.note,
    occurredAt: expense.occurredAt,
    category: {
      code: expense.category.code,
      nameEn: expense.category.nameEn,
      nameBn: expense.category.nameBn,
    },
  };
}

ownerFinanceRouter.get("/wallet/expense-categories", async (_req, res) => {
  const categories = await prisma.expenseCategoryLookup.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  res.json({
    ok: true,
    categories: categories.map((c) => ({
      code: c.code,
      nameEn: c.nameEn,
      nameBn: c.nameBn,
      description: c.description,
    })),
  });
});

ownerFinanceRouter.post(
  "/wallet/expenses",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = expenseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }
    try {
      const category = await prisma.expenseCategoryLookup.findUnique({
        where: { code: parsed.data.categoryCode },
      });
      if (!category || !category.isActive) {
        res.status(400).json({ ok: false, message: "Unknown expense category" });
        return;
      }
      const occurredAt = parsed.data.occurredAt
        ? new Date(parsed.data.occurredAt)
        : new Date();
      const typeCode = expenseWalletTypeCode(parsed.data.categoryCode);
      const contactBits = [parsed.data.contactName, parsed.data.contactPhone]
        .filter(Boolean)
        .join(" · ");
      const result = await recordWalletTxn({
        tenantId: tid(req),
        typeCode,
        amountBdt: parsed.data.amountBdt,
        note:
          parsed.data.note ??
          `${category.nameEn}: ${parsed.data.title}${contactBits ? ` — ${contactBits}` : ""}`,
        occurredAt,
        createdBy: req.auth!.id,
      });
      const expense = await prisma.cashExpense.create({
        data: {
          tenantId: tid(req),
          categoryId: category.id,
          title: parsed.data.title,
          amountBdt: parsed.data.amountBdt,
          contactName: parsed.data.contactName ?? null,
          contactPhone: parsed.data.contactPhone ?? null,
          note: parsed.data.note ?? null,
          occurredAt,
          cashTransactionId: result.transaction.id,
          createdBy: req.auth!.id,
        },
        include: { category: true },
      });
      res.status(201).json({
        ok: true,
        expense: serializeExpense(expense),
        wallet: {
          id: result.wallet.id,
          balanceBdt: Number(result.wallet.balanceBdt),
        },
        transaction: serializeTxn(result.transaction),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed";
      res.status(400).json({ ok: false, message });
    }
  },
);

ownerFinanceRouter.get(
  "/wallet/expenses",
  requireOwnerOrManager,
  async (req, res) => {
    const expenses = await prisma.cashExpense.findMany({
      where: { tenantId: tid(req) },
      include: { category: true },
      orderBy: { occurredAt: "desc" },
      take: 100,
    });
    res.json({
      ok: true,
      expenses: expenses.map(serializeExpense),
    });
  },
);

ownerFinanceRouter.patch(
  "/wallet/expenses/:id",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = expenseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }

    const existing = await prisma.cashExpense.findFirst({
      where: { id: String(req.params.id), tenantId: tid(req) },
      include: { category: true },
    });
    if (!existing) {
      res.status(404).json({ ok: false, message: "Expense not found" });
      return;
    }

    try {
      const category = await prisma.expenseCategoryLookup.findUnique({
        where: { code: parsed.data.categoryCode },
      });
      if (!category || !category.isActive) {
        res.status(400).json({ ok: false, message: "Unknown expense category" });
        return;
      }
      const occurredAt = parsed.data.occurredAt
        ? new Date(parsed.data.occurredAt)
        : existing.occurredAt;
      const typeCode = expenseWalletTypeCode(parsed.data.categoryCode);
      const contactBits = [parsed.data.contactName, parsed.data.contactPhone]
        .filter(Boolean)
        .join(" · ");
      const ledgerNote =
        parsed.data.note ??
        `${category.nameEn}: ${parsed.data.title}${contactBits ? ` — ${contactBits}` : ""}`;

      const result = await prisma.$transaction(async (tx) => {
        const walletEdit = await editManualDebitTxn({
          tenantId: tid(req),
          cashTransactionId: existing.cashTransactionId,
          newAmountBdt: parsed.data.amountBdt,
          note: ledgerNote,
          typeCode,
          occurredAt,
          updatedBy: req.auth!.id,
          tx,
        });
        const expense = await tx.cashExpense.update({
          where: { id: existing.id },
          data: {
            categoryId: category.id,
            title: parsed.data.title,
            amountBdt: parsed.data.amountBdt,
            contactName: parsed.data.contactName ?? null,
            contactPhone: parsed.data.contactPhone ?? null,
            note: parsed.data.note ?? null,
            occurredAt,
          },
          include: { category: true },
        });
        return { expense, walletEdit };
      });

      res.json({
        ok: true,
        expense: serializeExpense(result.expense),
        walletDeltaBdt: result.walletEdit.walletDeltaBdt,
        wallet: {
          id: result.walletEdit.wallet.id,
          balanceBdt: Number(result.walletEdit.wallet.balanceBdt),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed";
      res.status(400).json({ ok: false, message });
    }
  },
);

ownerFinanceRouter.get("/wallet/analytics", requireOwnerOnly, async (req, res) => {
  const tenantId = tid(req);
  const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 365);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [txns, purchases, expenses, wallet] = await Promise.all([
    prisma.cashTransaction.findMany({
      where: { tenantId, occurredAt: { gte: since } },
      include: {
        type: true,
        materialPurchase: { include: { kind: true, unit: true } },
        cashExpense: { include: { category: true } },
        sale: true,
        salaryPayment: true,
      },
      orderBy: { occurredAt: "desc" },
      take: 300,
    }),
    prisma.materialPurchase.findMany({
      where: {
        tenantId,
        purchasedAt: { gte: since },
        reversedAt: null,
      },
      include: { kind: true, unit: true },
      orderBy: { purchasedAt: "desc" },
      take: 100,
    }),
    prisma.cashExpense.findMany({
      where: { tenantId, occurredAt: { gte: since } },
      include: { category: true },
      orderBy: { occurredAt: "desc" },
      take: 100,
    }),
    ensureCashWallet(tenantId),
  ]);

  let salesCredit = 0;
  let salaryTotal = 0;
  let salaryReverseTotal = 0;
  let utilityTotal = 0;
  let transportExtra = 0;
  let otherExpense = 0;
  let otherCredit = 0;
  let otherDebit = 0;

  for (const txn of txns) {
    const amt = Number(txn.amountBdt);
    const code = txn.type.code;
    if (txn.type.direction === "credit") {
      if (code === "SALE") salesCredit += amt;
      else if (code === "SALARY_REVERSE") salaryReverseTotal += amt;
      else if (code === "MATERIAL_REVERSE") otherCredit += amt;
      else otherCredit += amt;
    } else if (code === "MATERIAL_BUY") {
      // Material totals come from active purchase rows (supports edits).
    } else if (code === "SALARY") salaryTotal += amt;
    else if (code === "UTILITY") utilityTotal += amt;
    else if (code === "TRANSPORT") transportExtra += amt;
    else if (code === "EXPENSE") otherExpense += amt;
    else otherDebit += amt;
  }

  let materialTotal = 0;
  let goodsSum = 0;
  let tripTransport = 0;
  let tripDriver = 0;
  let tripTravel = 0;
  const byKind: Record<
    string,
    { code: string; nameEn: string; nameBn: string; totalBdt: number; qty: number }
  > = {};

  for (const p of purchases) {
    materialTotal += Number(p.amountBdt);
    goodsSum += Number(p.goodsAmountBdt);
    tripTransport += Number(p.transportBdt);
    tripDriver += Number(p.driverBdt);
    tripTravel += Number(p.travelBdt);
    const key = p.kind.code;
    if (!byKind[key]) {
      byKind[key] = {
        code: p.kind.code,
        nameEn: p.kind.nameEn,
        nameBn: p.kind.nameBn,
        totalBdt: 0,
        qty: 0,
      };
    }
    byKind[key]!.totalBdt += Number(p.amountBdt);
    byKind[key]!.qty += Number(p.qty);
  }

  const byExpenseCat: Record<
    string,
    { code: string; nameEn: string; nameBn: string; totalBdt: number; count: number }
  > = {};
  for (const e of expenses) {
    const key = e.category.code;
    if (!byExpenseCat[key]) {
      byExpenseCat[key] = {
        code: e.category.code,
        nameEn: e.category.nameEn,
        nameBn: e.category.nameBn,
        totalBdt: 0,
        count: 0,
      };
    }
    byExpenseCat[key]!.totalBdt += Number(e.amountBdt);
    byExpenseCat[key]!.count += 1;
  }

  const transactions = txns.map((txn) => {
    const base = serializeTxn(txn);
    if (txn.materialPurchase) {
      const p = serializePurchase(txn.materialPurchase);
      return {
        ...base,
        detailType: "material" as const,
        detail: p,
      };
    }
    if (txn.cashExpense) {
      return {
        ...base,
        detailType: "expense" as const,
        detail: {
          id: txn.cashExpense.id,
          title: txn.cashExpense.title,
          amountBdt: Number(txn.cashExpense.amountBdt),
          contactName: txn.cashExpense.contactName,
          contactPhone: txn.cashExpense.contactPhone,
          category: {
            code: txn.cashExpense.category.code,
            nameEn: txn.cashExpense.category.nameEn,
            nameBn: txn.cashExpense.category.nameBn,
          },
        },
      };
    }
    if (txn.sale) {
      return {
        ...base,
        detailType: "sale" as const,
        detail: {
          id: txn.sale.id,
          amountBdt: Number(txn.sale.amountBdt),
          buyerName: txn.sale.buyerName,
        },
      };
    }
    if (txn.salaryPayment) {
      return {
        ...base,
        detailType: "salary" as const,
        detail: {
          id: txn.salaryPayment.id,
          amountBdt: Number(txn.salaryPayment.amountBdt),
          periodLabel: txn.salaryPayment.periodLabel,
        },
      };
    }
    return { ...base, detailType: "other" as const, detail: null };
  });

  res.json({
    ok: true,
    days,
    since,
    wallet: {
      id: wallet.id,
      balanceBdt: Number(wallet.balanceBdt),
    },
    totals: {
      salesCreditBdt: salesCredit,
      materialTotalBdt: materialTotal,
      materialGoodsBdt: goodsSum,
      materialTransportBdt: tripTransport,
      materialDriverBdt: tripDriver,
      materialTravelBdt: tripTravel,
      standaloneTransportBdt: transportExtra,
      utilityBdt: utilityTotal,
      otherExpenseBdt: otherExpense,
      salaryBdt: salaryTotal,
      salaryReverseBdt: salaryReverseTotal,
      otherCreditBdt: otherCredit,
      otherDebitBdt: otherDebit,
      netCashFlowBdt:
        salesCredit +
        otherCredit +
        salaryReverseTotal -
        (materialTotal +
          salaryTotal +
          utilityTotal +
          transportExtra +
          otherExpense +
          otherDebit),
    },
    bySupplyKind: Object.values(byKind),
    byExpenseCategory: Object.values(byExpenseCat),
    purchases: purchases.map(serializePurchase),
    transactions,
  });
});

/* ───────── Salary payments ───────── */

ownerFinanceRouter.get("/payments", requireOwnerOrManager, async (req, res) => {
  const payments = await prisma.salaryPayment.findMany({
    where: { tenantId: tid(req) },
    include: {
      user: { include: { role: true } },
      cashTransaction: { include: { type: true } },
      reverseCashTransaction: { include: { type: true } },
    },
    orderBy: { paidAt: "desc" },
    take: 100,
  });
  res.json({
    ok: true,
    payments: payments.map((p) => ({
      id: p.id,
      amountBdt: Number(p.amountBdt),
      periodLabel: p.periodLabel,
      note: p.note,
      paidAt: p.paidAt,
      isReversed: Boolean(p.reversedAt),
      reverseReason: p.reverseReason,
      reversedAt: p.reversedAt,
      staff: {
        id: p.user.id,
        name: p.user.name,
        email: p.user.email,
        role: p.user.role.code,
        salaryBdt:
          p.user.salaryBdt == null ? null : Number(p.user.salaryBdt),
      },
      transaction: serializeTxn(p.cashTransaction),
      reverseTransaction: p.reverseCashTransaction
        ? serializeTxn(p.reverseCashTransaction)
        : null,
    })),
  });
});

const paySchema = z.object({
  userId: z.string().min(1),
  amountBdt: z.coerce.number().positive().optional(),
  periodLabel: z.string().max(64).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  paidAt: z.string().datetime().optional(),
});

ownerFinanceRouter.post("/payments", requireOwnerOnly, async (req, res) => {
  const parsed = paySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: parsed.error.message });
    return;
  }

  const staff = await prisma.user.findFirst({
    where: {
      id: parsed.data.userId,
      tenantId: tid(req),
      isActive: true,
      role: { code: { in: ["MANAGER", "EMPLOYEE"] } },
    },
    include: { role: true },
  });
  if (!staff) {
    res.status(404).json({ ok: false, message: "Staff not found" });
    return;
  }

  const amount =
    parsed.data.amountBdt ??
    (staff.salaryBdt != null ? Number(staff.salaryBdt) : null);
  if (amount == null || !(amount > 0)) {
    res.status(400).json({
      ok: false,
      message: "amountBdt required when staff has no salary set",
    });
    return;
  }

  try {
    const paidAt = parsed.data.paidAt
      ? new Date(parsed.data.paidAt)
      : new Date();
    const result = await recordWalletTxn({
      tenantId: tid(req),
      typeCode: "SALARY",
      amountBdt: amount,
      note:
        parsed.data.note ??
        `Salary — ${staff.name}${parsed.data.periodLabel ? ` (${parsed.data.periodLabel})` : ""}`,
      occurredAt: paidAt,
      createdBy: req.auth!.id,
    });
    const payment = await prisma.salaryPayment.create({
      data: {
        tenantId: tid(req),
        userId: staff.id,
        amountBdt: amount,
        periodLabel: parsed.data.periodLabel ?? null,
        note: parsed.data.note ?? null,
        paidAt,
        cashTransactionId: result.transaction.id,
        createdBy: req.auth!.id,
      },
      include: {
        user: { include: { role: true } },
        cashTransaction: { include: { type: true } },
      },
    });
    res.status(201).json({
      ok: true,
      payment: {
        id: payment.id,
        amountBdt: Number(payment.amountBdt),
        periodLabel: payment.periodLabel,
        paidAt: payment.paidAt,
        isReversed: false,
        staff: serializeStaff(payment.user),
      },
      wallet: {
        id: result.wallet.id,
        balanceBdt: Number(result.wallet.balanceBdt),
      },
      transaction: serializeTxn(payment.cashTransaction),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    res.status(400).json({ ok: false, message });
  }
});

const reversePaySchema = z.object({
  reason: z.string().min(5).max(500),
});

const editPaySchema = z.object({
  amountBdt: z.coerce.number().positive(),
  periodLabel: z.string().max(64).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  paidAt: z.string().datetime().optional(),
});

ownerFinanceRouter.patch(
  "/payments/:id",
  requireOwnerOnly,
  async (req, res) => {
    const parsed = editPaySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }

    const existing = await prisma.salaryPayment.findFirst({
      where: { id: String(req.params.id), tenantId: tid(req) },
      include: {
        user: { include: { role: true } },
        cashTransaction: { include: { type: true } },
      },
    });
    if (!existing) {
      res.status(404).json({ ok: false, message: "Salary payment not found" });
      return;
    }
    if (existing.reversedAt) {
      res.status(400).json({
        ok: false,
        message: "Reversed salary payment cannot be edited",
      });
      return;
    }

    try {
      const paidAt = parsed.data.paidAt
        ? new Date(parsed.data.paidAt)
        : existing.paidAt;
      const periodLabel =
        parsed.data.periodLabel === undefined
          ? existing.periodLabel
          : parsed.data.periodLabel;
      const note =
        parsed.data.note === undefined ? existing.note : parsed.data.note;
      const ledgerNote =
        note ??
        `Salary — ${existing.user.name}${periodLabel ? ` (${periodLabel})` : ""}`;

      const result = await prisma.$transaction(async (tx) => {
        const walletEdit = await editManualDebitTxn({
          tenantId: tid(req),
          cashTransactionId: existing.cashTransactionId,
          newAmountBdt: parsed.data.amountBdt,
          note: ledgerNote,
          typeCode: "SALARY",
          occurredAt: paidAt,
          updatedBy: req.auth!.id,
          tx,
        });
        const payment = await tx.salaryPayment.update({
          where: { id: existing.id },
          data: {
            amountBdt: parsed.data.amountBdt,
            periodLabel,
            note,
            paidAt,
          },
          include: {
            user: { include: { role: true } },
            cashTransaction: { include: { type: true } },
          },
        });
        return { payment, walletEdit };
      });

      res.json({
        ok: true,
        payment: {
          id: result.payment.id,
          amountBdt: Number(result.payment.amountBdt),
          periodLabel: result.payment.periodLabel,
          note: result.payment.note,
          paidAt: result.payment.paidAt,
          isReversed: false,
          staff: serializeStaff(result.payment.user),
        },
        walletDeltaBdt: result.walletEdit.walletDeltaBdt,
        wallet: {
          id: result.walletEdit.wallet.id,
          balanceBdt: Number(result.walletEdit.wallet.balanceBdt),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed";
      res.status(400).json({ ok: false, message });
    }
  },
);

ownerFinanceRouter.post(
  "/payments/:id/reverse",
  requireOwnerOnly,
  async (req, res) => {
    const parsed = reversePaySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        message: "Clear reverse reason required (min 5 characters)",
      });
      return;
    }

    const payment = await prisma.salaryPayment.findFirst({
      where: { id: String(req.params.id), tenantId: tid(req) },
      include: {
        user: { include: { role: true } },
      },
    });
    if (!payment) {
      res.status(404).json({ ok: false, message: "Salary payment not found" });
      return;
    }
    if (payment.reversedAt) {
      res.status(400).json({
        ok: false,
        message: "Salary payment already reversed",
      });
      return;
    }

    const reason = parsed.data.reason.trim();
    const amountBdt = Number(payment.amountBdt);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const walletResult = await recordWalletTxn({
          tenantId: tid(req),
          typeCode: "SALARY_REVERSE",
          amountBdt,
          note: `Salary reverse — ${payment.user.name}: ${reason}`,
          reference: payment.id,
          createdBy: req.auth!.id,
          tx,
        });
        const updated = await tx.salaryPayment.update({
          where: { id: payment.id },
          data: {
            reverseReason: reason,
            reversedAt: new Date(),
            reversedBy: req.auth!.id,
            reverseCashTransactionId: walletResult.transaction.id,
          },
          include: {
            user: { include: { role: true } },
            cashTransaction: { include: { type: true } },
            reverseCashTransaction: { include: { type: true } },
          },
        });
        return { updated, walletResult };
      });

      res.json({
        ok: true,
        payment: {
          id: result.updated.id,
          amountBdt: Number(result.updated.amountBdt),
          periodLabel: result.updated.periodLabel,
          paidAt: result.updated.paidAt,
          isReversed: true,
          reverseReason: result.updated.reverseReason,
          reversedAt: result.updated.reversedAt,
          staff: serializeStaff(result.updated.user),
        },
        cashCreditedBdt: amountBdt,
        wallet: {
          id: result.walletResult.wallet.id,
          balanceBdt: Number(result.walletResult.wallet.balanceBdt),
        },
        transaction: serializeTxn(result.walletResult.transaction),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Salary reverse failed";
      res.status(400).json({ ok: false, message });
    }
  },
);
