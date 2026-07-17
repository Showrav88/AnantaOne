import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { hashPassword } from "../lib/auth.js";
import {
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
  isActive: boolean;
  createdAt: Date;
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
    isActive: user.isActive,
    createdAt: user.createdAt,
    role: {
      code: user.role.code,
      nameEn: user.role.nameEn,
      nameBn: user.role.nameBn,
    },
  };
}

/* ───────── Staff (manager / employee) ───────── */

ownerFinanceRouter.get("/staff", requireOwnerOrManager, async (req, res) => {
  const staff = await prisma.user.findMany({
    where: {
      tenantId: tid(req),
      role: { code: { in: ["MANAGER", "EMPLOYEE", "OWNER"] } },
    },
    include: { role: true },
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
  employeeCode: z.string().max(32).nullable().optional(),
  designation: z.string().max(120).nullable().optional(),
  joiningDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
  salaryBdt: z.coerce.number().nonnegative().nullable().optional(),
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

  const branch = await prisma.branch.findFirst({
    where: { tenantId: tid(req) },
    orderBy: { createdAt: "asc" },
  });

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
        branchId: branch?.id ?? null,
        email,
        name: data.name,
        phone: data.phone ?? null,
        passwordHash: await hashPassword(data.password),
        roleId: role.id,
        employeeCode: data.employeeCode || null,
        designation: data.designation ?? null,
        joiningDate,
        salaryBdt: data.salaryBdt ?? null,
        createdBy: req.auth!.id,
      },
      include: { role: true },
    });
    res.status(201).json({ ok: true, staff: serializeStaff(user) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "create failed";
    res.status(400).json({ ok: false, message });
  }
});

const staffUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(32).nullable().optional(),
  roleCode: z.enum(["MANAGER", "EMPLOYEE"]).optional(),
  employeeCode: z.string().max(32).nullable().optional(),
  designation: z.string().max(120).nullable().optional(),
  joiningDate: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .nullable()
    .optional(),
  salaryBdt: z.coerce.number().nonnegative().nullable().optional(),
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

  const { roleCode: _r, password: _p, joiningDate: _j, ...rest } = parsed.data;
  const user = await prisma.user.update({
    where: { id: existing.id },
    data: {
      ...rest,
      ...(roleId ? { roleId } : {}),
      ...(joiningDate !== undefined ? { joiningDate } : {}),
      ...(passwordHash ? { passwordHash } : {}),
      updatedBy: req.auth!.id,
    },
    include: { role: true },
  });

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

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { isActive: false, updatedBy: req.auth!.id },
    include: { role: true },
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

const materialSchema = z.object({
  materialName: z.string().min(2).max(160),
  amountBdt: z.coerce.number().positive(),
  supplierName: z.string().max(160).nullable().optional(),
  supplierPhone: z.string().max(40).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  purchasedAt: z.string().datetime().optional(),
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
      const purchasedAt = parsed.data.purchasedAt
        ? new Date(parsed.data.purchasedAt)
        : new Date();
      const supplierBits = [
        parsed.data.supplierName,
        parsed.data.supplierPhone,
      ]
        .filter(Boolean)
        .join(" · ");
      const result = await recordWalletTxn({
        tenantId: tid(req),
        typeCode: "MATERIAL_BUY",
        amountBdt: parsed.data.amountBdt,
        note:
          parsed.data.note ??
          `${parsed.data.materialName}${supplierBits ? ` — ${supplierBits}` : ""}`,
        occurredAt: purchasedAt,
        createdBy: req.auth!.id,
      });
      const purchase = await prisma.materialPurchase.create({
        data: {
          tenantId: tid(req),
          materialName: parsed.data.materialName,
          supplierName: parsed.data.supplierName ?? null,
          supplierPhone: parsed.data.supplierPhone ?? null,
          amountBdt: parsed.data.amountBdt,
          note: parsed.data.note ?? null,
          purchasedAt,
          cashTransactionId: result.transaction.id,
          createdBy: req.auth!.id,
        },
      });
      res.status(201).json({
        ok: true,
        purchase: {
          id: purchase.id,
          materialName: purchase.materialName,
          supplierName: purchase.supplierName,
          supplierPhone: purchase.supplierPhone,
          amountBdt: Number(purchase.amountBdt),
          purchasedAt: purchase.purchasedAt,
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

const expenseSchema = z.object({
  categoryCode: z.enum([
    "UTILITY",
    "FAMILY",
    "LAWSUIT",
    "GESTURE",
    "OTHER",
  ]),
  title: z.string().min(2).max(160),
  amountBdt: z.coerce.number().positive(),
  contactName: z.string().max(160).nullable().optional(),
  contactPhone: z.string().max(40).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  occurredAt: z.string().datetime().optional(),
});

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
      const typeCode =
        parsed.data.categoryCode === "UTILITY" ? "UTILITY" : "EXPENSE";
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
        expense: {
          id: expense.id,
          title: expense.title,
          amountBdt: Number(expense.amountBdt),
          contactName: expense.contactName,
          contactPhone: expense.contactPhone,
          occurredAt: expense.occurredAt,
          category: {
            code: expense.category.code,
            nameEn: expense.category.nameEn,
            nameBn: expense.category.nameBn,
          },
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

/* ───────── Salary payments ───────── */

ownerFinanceRouter.get("/payments", requireOwnerOrManager, async (req, res) => {
  const payments = await prisma.salaryPayment.findMany({
    where: { tenantId: tid(req) },
    include: {
      user: { include: { role: true } },
      cashTransaction: { include: { type: true } },
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
      staff: {
        id: p.user.id,
        name: p.user.name,
        email: p.user.email,
        role: p.user.role.code,
        salaryBdt:
          p.user.salaryBdt == null ? null : Number(p.user.salaryBdt),
      },
      transaction: serializeTxn(p.cashTransaction),
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
