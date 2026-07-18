import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import {
  requireCompanyStaff,
  requireOwnerOrManager,
} from "../middleware/companyAccess.js";
import { normalizeCategory } from "../lib/delivery.js";
import {
  acceptOnlineOrder,
  serializeOnlineOrder,
  setOnlineOrderStatus,
} from "../lib/onlineOrder.js";

export const ownerCommerceRouter = Router();
ownerCommerceRouter.use(requireAuth, requireCompanyStaff);

function tid(req: { auth?: { tenantId: string | null } }) {
  return req.auth!.tenantId!;
}

function serializeBuyer(b: {
  id: string;
  shopName: string;
  contactName: string | null;
  phone: string;
  address: string | null;
  wardId: string | null;
  locale: string;
  isActive: boolean;
  ward?: { id: string; name: string; nameBn: string | null } | null;
  _count?: { salesOrders: number };
  orderStats?: { orderCount: number; totalSpentBdt: number };
}) {
  return {
    id: b.id,
    shopName: b.shopName,
    contactName: b.contactName,
    phone: b.phone,
    address: b.address,
    wardId: b.wardId,
    ward: b.ward
      ? { id: b.ward.id, name: b.ward.name, nameBn: b.ward.nameBn }
      : null,
    locale: b.locale,
    isActive: b.isActive,
    orderCount: b.orderStats?.orderCount ?? b._count?.salesOrders ?? 0,
    totalSpentBdt: b.orderStats?.totalSpentBdt ?? 0,
  };
}

const buyerSchema = z.object({
  shopName: z.string().min(2).max(160),
  contactName: z.string().max(120).nullable().optional(),
  phone: z.string().min(6).max(32),
  address: z.string().max(240).nullable().optional(),
  wardId: z.string().cuid().nullable().optional(),
  locale: z.enum(["bn", "en"]).optional(),
  isActive: z.boolean().optional(),
});

ownerCommerceRouter.get("/buyers", async (req, res) => {
  const buyers = await prisma.buyer.findMany({
    where: { tenantId: tid(req) },
    include: {
      ward: true,
      salesOrders: {
        where: { status: { code: { notIn: ["CANCELLED", "REVERSED"] } } },
        select: { totalBdt: true },
      },
    },
    orderBy: { shopName: "asc" },
  });

  res.json({
    ok: true,
    buyers: buyers.map((b) =>
      serializeBuyer({
        ...b,
        orderStats: {
          orderCount: b.salesOrders.length,
          totalSpentBdt: b.salesOrders.reduce(
            (s, o) => s + Number(o.totalBdt),
            0,
          ),
        },
      }),
    ),
  });
});

ownerCommerceRouter.get("/buyers/analytics", async (req, res) => {
  const buyers = await prisma.buyer.findMany({
    where: { tenantId: tid(req), isActive: true },
    include: {
      ward: true,
      salesOrders: {
        where: {
          status: { code: { in: ["ACCEPTED", "CONFIRMED", "OUT_FOR_DELIVERY", "DELIVERED"] } },
        },
        select: {
          totalBdt: true,
          subtotalBdt: true,
          orderedAt: true,
          source: { select: { code: true } },
        },
      },
    },
  });

  const rows = buyers
    .map((b) => {
      const totalSpentBdt = b.salesOrders.reduce(
        (s, o) => s + Number(o.totalBdt),
        0,
      );
      const onlineSpentBdt = b.salesOrders
        .filter((o) => o.source.code === "ONLINE")
        .reduce((s, o) => s + Number(o.totalBdt), 0);
      return {
        id: b.id,
        shopName: b.shopName,
        contactName: b.contactName,
        phone: b.phone,
        ward: b.ward
          ? { id: b.ward.id, name: b.ward.name, nameBn: b.ward.nameBn }
          : null,
        orderCount: b.salesOrders.length,
        totalSpentBdt,
        onlineSpentBdt,
        lastOrderAt: b.salesOrders.length
          ? [...b.salesOrders].sort(
              (a, c) => c.orderedAt.getTime() - a.orderedAt.getTime(),
            )[0]!.orderedAt
          : null,
      };
    })
    .sort((a, b) => b.totalSpentBdt - a.totalSpentBdt);

  res.json({
    ok: true,
    analytics: {
      buyerCount: rows.length,
      totalRevenueBdt: rows.reduce((s, r) => s + r.totalSpentBdt, 0),
      buyers: rows,
    },
  });
});

ownerCommerceRouter.post("/buyers", requireOwnerOrManager, async (req, res) => {
  const parsed = buyerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: parsed.error.message });
    return;
  }
  try {
    const buyer = await prisma.buyer.create({
      data: {
        tenantId: tid(req),
        shopName: parsed.data.shopName,
        contactName: parsed.data.contactName ?? null,
        phone: parsed.data.phone.trim(),
        address: parsed.data.address ?? null,
        wardId: parsed.data.wardId ?? null,
        locale: parsed.data.locale ?? "bn",
        isActive: parsed.data.isActive ?? true,
      },
      include: { ward: true },
    });
    res.status(201).json({ ok: true, buyer: serializeBuyer(buyer) });
  } catch (err) {
    res.status(400).json({
      ok: false,
      message: err instanceof Error ? err.message : "Create failed",
    });
  }
});

ownerCommerceRouter.patch(
  "/buyers/:id",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = buyerSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }
    const existing = await prisma.buyer.findFirst({
      where: { id: String(req.params.id), tenantId: tid(req) },
    });
    if (!existing) {
      res.status(404).json({ ok: false, message: "Buyer not found" });
      return;
    }
    const buyer = await prisma.buyer.update({
      where: { id: existing.id },
      data: {
        ...parsed.data,
        phone: parsed.data.phone?.trim(),
      },
      include: { ward: true },
    });
    res.json({ ok: true, buyer: serializeBuyer(buyer) });
  },
);

/* —— Delivery wards —— */
ownerCommerceRouter.get("/delivery/wards", async (req, res) => {
  const branchId = req.query.branchId ? String(req.query.branchId) : undefined;
  const wards = await prisma.deliveryWard.findMany({
    where: {
      tenantId: tid(req),
      ...(branchId ? { OR: [{ branchId: null }, { branchId }] } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  res.json({
    ok: true,
    wards: wards.map((w) => ({
      id: w.id,
      branchId: w.branchId,
      name: w.name,
      nameBn: w.nameBn,
      sortOrder: w.sortOrder,
      freeDelivery: w.freeDelivery,
      baseChargeBdt: Number(w.baseChargeBdt),
      isActive: w.isActive,
    })),
  });
});

const wardSchema = z.object({
  name: z.string().min(1).max(80),
  nameBn: z.string().max(80).nullable().optional(),
  branchId: z.string().cuid().nullable().optional(),
  sortOrder: z.coerce.number().int().optional(),
  freeDelivery: z.boolean().optional(),
  baseChargeBdt: z.coerce.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

ownerCommerceRouter.post(
  "/delivery/wards",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = wardSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }
    const ward = await prisma.deliveryWard.create({
      data: {
        tenantId: tid(req),
        name: parsed.data.name,
        nameBn: parsed.data.nameBn ?? null,
        branchId: parsed.data.branchId ?? null,
        sortOrder: parsed.data.sortOrder ?? 0,
        freeDelivery: parsed.data.freeDelivery ?? false,
        baseChargeBdt: parsed.data.baseChargeBdt ?? 0,
        isActive: parsed.data.isActive ?? true,
      },
    });
    res.status(201).json({
      ok: true,
      ward: {
        ...ward,
        baseChargeBdt: Number(ward.baseChargeBdt),
      },
    });
  },
);

ownerCommerceRouter.patch(
  "/delivery/wards/:id",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = wardSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }
    const existing = await prisma.deliveryWard.findFirst({
      where: { id: String(req.params.id), tenantId: tid(req) },
    });
    if (!existing) {
      res.status(404).json({ ok: false, message: "Ward not found" });
      return;
    }
    const ward = await prisma.deliveryWard.update({
      where: { id: existing.id },
      data: parsed.data,
    });
    res.json({
      ok: true,
      ward: { ...ward, baseChargeBdt: Number(ward.baseChargeBdt) },
    });
  },
);

ownerCommerceRouter.post(
  "/delivery/wards/seed-lakshmipur",
  requireOwnerOrManager,
  async (req, res) => {
    const tenantId = tid(req);
    const branchId =
      typeof req.body?.branchId === "string" ? req.body.branchId : null;
    const created = [];
    for (let i = 1; i <= 15; i += 1) {
      const name = `Ward ${i}`;
      const existing = await prisma.deliveryWard.findFirst({
        where: { tenantId, name, branchId },
      });
      if (existing) {
        created.push(existing);
        continue;
      }
      const ward = await prisma.deliveryWard.create({
        data: {
          tenantId,
          branchId,
          name,
          nameBn: `ওয়ার্ড ${i}`,
          sortOrder: i,
          freeDelivery: i <= 5,
          baseChargeBdt: i <= 5 ? 0 : 30 + i * 5,
        },
      });
      created.push(ward);
    }

    // Default category rates if missing
    const defaults = [
      { category: "DRINKING", chargePerUnitBdt: 5, note: "Per bottle/jar by weight" },
      { category: "DISTILLED", chargePerUnitBdt: 8, note: "Distilled water delivery" },
      { category: "BATTERY", chargePerUnitBdt: 10, note: "Battery water delivery" },
      { category: "OTHER", chargePerUnitBdt: 6, note: "Fallback" },
    ];
    for (const d of defaults) {
      await prisma.deliveryCategoryRate.upsert({
        where: {
          tenantId_category: { tenantId, category: d.category },
        },
        create: { tenantId, ...d },
        update: {},
      });
    }

    res.json({
      ok: true,
      wards: created.map((w) => ({
        ...w,
        baseChargeBdt: Number(w.baseChargeBdt),
      })),
    });
  },
);

/* —— Category delivery rates —— */
ownerCommerceRouter.get("/delivery/rates", async (req, res) => {
  const rates = await prisma.deliveryCategoryRate.findMany({
    where: { tenantId: tid(req) },
    orderBy: { category: "asc" },
  });
  res.json({
    ok: true,
    rates: rates.map((r) => ({
      id: r.id,
      category: r.category,
      chargePerUnitBdt: Number(r.chargePerUnitBdt),
      note: r.note,
      isActive: r.isActive,
    })),
  });
});

const rateSchema = z.object({
  category: z.string().min(1).max(32),
  chargePerUnitBdt: z.coerce.number().nonnegative(),
  note: z.string().max(200).nullable().optional(),
  isActive: z.boolean().optional(),
});

ownerCommerceRouter.post(
  "/delivery/rates",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = rateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }
    const category = normalizeCategory(parsed.data.category);
    const rate = await prisma.deliveryCategoryRate.upsert({
      where: {
        tenantId_category: { tenantId: tid(req), category },
      },
      create: {
        tenantId: tid(req),
        category,
        chargePerUnitBdt: parsed.data.chargePerUnitBdt,
        note: parsed.data.note ?? null,
        isActive: parsed.data.isActive ?? true,
      },
      update: {
        chargePerUnitBdt: parsed.data.chargePerUnitBdt,
        note: parsed.data.note ?? null,
        isActive: parsed.data.isActive ?? true,
      },
    });
    res.json({
      ok: true,
      rate: {
        ...rate,
        chargePerUnitBdt: Number(rate.chargePerUnitBdt),
      },
    });
  },
);

/* —— Coupons —— */
ownerCommerceRouter.get("/coupons", async (req, res) => {
  const coupons = await prisma.coupon.findMany({
    where: { tenantId: tid(req) },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    ok: true,
    coupons: coupons.map((c) => ({
      id: c.id,
      code: c.code,
      discountType: c.discountType,
      discountValue: Number(c.discountValue),
      minOrderBdt: c.minOrderBdt != null ? Number(c.minOrderBdt) : null,
      maxDiscountBdt:
        c.maxDiscountBdt != null ? Number(c.maxDiscountBdt) : null,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      usageLimit: c.usageLimit,
      usedCount: c.usedCount,
      isActive: c.isActive,
    })),
  });
});

const couponSchema = z.object({
  code: z.string().min(2).max(40),
  discountType: z.enum(["PERCENT", "FIXED"]),
  discountValue: z.coerce.number().positive(),
  minOrderBdt: z.coerce.number().nonnegative().nullable().optional(),
  maxDiscountBdt: z.coerce.number().nonnegative().nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  usageLimit: z.coerce.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
});

ownerCommerceRouter.post("/coupons", requireOwnerOrManager, async (req, res) => {
  const parsed = couponSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: parsed.error.message });
    return;
  }
  const coupon = await prisma.coupon.create({
    data: {
      tenantId: tid(req),
      code: parsed.data.code.trim().toUpperCase(),
      discountType: parsed.data.discountType,
      discountValue: parsed.data.discountValue,
      minOrderBdt: parsed.data.minOrderBdt ?? null,
      maxDiscountBdt: parsed.data.maxDiscountBdt ?? null,
      startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      usageLimit: parsed.data.usageLimit ?? null,
      isActive: parsed.data.isActive ?? true,
    },
  });
  res.status(201).json({
    ok: true,
    coupon: {
      ...coupon,
      discountValue: Number(coupon.discountValue),
      minOrderBdt:
        coupon.minOrderBdt != null ? Number(coupon.minOrderBdt) : null,
      maxDiscountBdt:
        coupon.maxDiscountBdt != null ? Number(coupon.maxDiscountBdt) : null,
    },
  });
});

ownerCommerceRouter.patch(
  "/coupons/:id",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = couponSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }
    const existing = await prisma.coupon.findFirst({
      where: { id: String(req.params.id), tenantId: tid(req) },
    });
    if (!existing) {
      res.status(404).json({ ok: false, message: "Coupon not found" });
      return;
    }
    const coupon = await prisma.coupon.update({
      where: { id: existing.id },
      data: {
        ...parsed.data,
        code: parsed.data.code?.trim().toUpperCase(),
        startsAt:
          parsed.data.startsAt !== undefined
            ? parsed.data.startsAt
              ? new Date(parsed.data.startsAt)
              : null
            : undefined,
        endsAt:
          parsed.data.endsAt !== undefined
            ? parsed.data.endsAt
              ? new Date(parsed.data.endsAt)
              : null
            : undefined,
      },
    });
    res.json({
      ok: true,
      coupon: {
        ...coupon,
        discountValue: Number(coupon.discountValue),
        minOrderBdt:
          coupon.minOrderBdt != null ? Number(coupon.minOrderBdt) : null,
        maxDiscountBdt:
          coupon.maxDiscountBdt != null ? Number(coupon.maxDiscountBdt) : null,
      },
    });
  },
);

/* —— Online orders —— */
ownerCommerceRouter.get("/online-orders", async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const orders = await prisma.salesOrder.findMany({
    where: {
      tenantId: tid(req),
      source: { code: "ONLINE" },
      ...(status ? { status: { code: status } } : {}),
    },
    include: {
      source: true,
      status: true,
      buyer: true,
      ward: true,
      coupon: true,
      lines: { include: { product: true, batch: true } },
    },
    orderBy: { orderedAt: "desc" },
    take: 100,
  });
  res.json({
    ok: true,
    orders: orders.map(serializeOnlineOrder),
  });
});

ownerCommerceRouter.post(
  "/online-orders/:id/accept",
  requireOwnerOrManager,
  async (req, res) => {
    try {
      const order = await acceptOnlineOrder({
        tenantId: tid(req),
        orderId: String(req.params.id),
        userId: req.auth!.id,
        creditWallet: req.body?.creditWallet !== false,
      });
      res.json({ ok: true, order });
    } catch (err) {
      res.status(400).json({
        ok: false,
        message: err instanceof Error ? err.message : "Accept failed",
      });
    }
  },
);

ownerCommerceRouter.post(
  "/online-orders/:id/status",
  requireOwnerOrManager,
  async (req, res) => {
    const statusCode = String(req.body?.statusCode ?? "");
    if (
      !["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"].includes(statusCode)
    ) {
      res.status(400).json({ ok: false, message: "Invalid statusCode" });
      return;
    }
    try {
      const order = await setOnlineOrderStatus({
        tenantId: tid(req),
        orderId: String(req.params.id),
        userId: req.auth!.id,
        statusCode: statusCode as "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED",
      });
      res.json({ ok: true, order });
    } catch (err) {
      res.status(400).json({
        ok: false,
        message: err instanceof Error ? err.message : "Update failed",
      });
    }
  },
);
