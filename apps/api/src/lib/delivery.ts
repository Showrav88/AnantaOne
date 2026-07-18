import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";
import { getOrCreateDeliverySettings } from "./bdGeo.js";

type Tx = Prisma.TransactionClient | typeof prisma;

export function normalizeCategory(category: string | null | undefined) {
  const raw = (category ?? "OTHER").trim().toUpperCase();
  if (raw === "WATER" || raw === "DRINKING_WATER" || raw === "DRINKING") {
    return "DRINKING";
  }
  if (raw === "DISTILLED" || raw === "RO" || raw === "R/O") return "DISTILLED";
  if (raw === "BATTERY" || raw === "BATTERY_WATER") return "BATTERY";
  if (raw === "OTHER" || raw === "*") return raw === "*" ? "*" : "OTHER";
  return raw || "OTHER";
}

export type QuoteLine = {
  productId: string;
  category: string;
  qty: number;
  unitPriceBdt: number;
};

export type DeliveryZone =
  | "WARD_FREE"
  | "WARD_LOCAL"
  | "OUTSIDE_AREA"
  | "SAME_DISTRICT"
  | "OTHER_DISTRICT";

export type DeliveryQuote = {
  subtotalBdt: number;
  deliveryBdt: number;
  discountBdt: number;
  totalBdt: number;
  freeDelivery: boolean;
  zone: DeliveryZone;
  zoneLabel: string;
  ward: {
    id: string;
    name: string;
    nameBn: string | null;
    freeDelivery: boolean;
    baseChargeBdt: number;
  } | null;
  coupon: {
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
  } | null;
  breakdown: Array<{
    category: string;
    qty: number;
    chargePerUnitBdt: number;
    lineDeliveryBdt: number;
  }>;
};

export async function quoteOrderTotals(
  tenantId: string,
  opts: {
    lines: QuoteLine[];
    wardId?: string | null;
    districtId?: string | null;
    upazilaId?: string | null;
    branchId?: string | null;
    couponCode?: string | null;
  },
  db: Tx = prisma,
): Promise<DeliveryQuote> {
  const subtotalBdt = opts.lines.reduce(
    (sum, l) => sum + Number(l.qty) * Number(l.unitPriceBdt),
    0,
  );

  const company = await db.company.findUniqueOrThrow({
    where: { id: tenantId },
    select: { districtId: true, upazilaId: true },
  });
  const settings = await getOrCreateDeliverySettings(tenantId);

  let ward: DeliveryQuote["ward"] = null;
  let freeDelivery = false;
  let baseCharge = 0;
  let zone: DeliveryZone = "OUTSIDE_AREA";
  let zoneLabel = "Outside delivery area";
  let applyCategoryRates = true;

  if (opts.wardId) {
    const w = await db.deliveryWard.findFirst({
      where: {
        id: opts.wardId,
        tenantId,
        isActive: true,
        OR: [
          { branchId: null },
          ...(opts.branchId ? [{ branchId: opts.branchId }] : []),
        ],
      },
    });
    if (w) {
      ward = {
        id: w.id,
        name: w.name,
        nameBn: w.nameBn,
        freeDelivery: w.freeDelivery,
        baseChargeBdt: Number(w.baseChargeBdt),
      };
      freeDelivery = w.freeDelivery;
      baseCharge = Number(w.baseChargeBdt);
      zone = freeDelivery ? "WARD_FREE" : "WARD_LOCAL";
      zoneLabel = freeDelivery ? "Free delivery (nearest ward)" : "Local ward";
    }
  }

  if (!ward) {
    applyCategoryRates = false;
    const destDistrictId = opts.districtId ?? null;
    const destUpazilaId = opts.upazilaId ?? null;

    if (
      company.districtId &&
      destDistrictId &&
      destDistrictId !== company.districtId
    ) {
      zone = "OTHER_DISTRICT";
      zoneLabel = "Other district (zila) delivery";
      baseCharge = Number(settings.otherDistrictChargeBdt);
    } else if (
      company.upazilaId &&
      destUpazilaId &&
      destUpazilaId !== company.upazilaId &&
      company.districtId &&
      destDistrictId === company.districtId
    ) {
      zone = "SAME_DISTRICT";
      zoneLabel = "Same district, other upazila";
      baseCharge = Number(settings.sameDistrictChargeBdt);
    } else {
      zone = "OUTSIDE_AREA";
      zoneLabel = "Outside covered wards / area";
      baseCharge = Number(settings.outsideAreaChargeBdt);
    }
  }

  const rates = await db.deliveryCategoryRate.findMany({
    where: { tenantId, isActive: true },
  });
  const rateMap = new Map(
    rates.map((r) => [normalizeCategory(r.category), Number(r.chargePerUnitBdt)]),
  );

  const byCat = new Map<string, number>();
  for (const line of opts.lines) {
    const cat = normalizeCategory(line.category);
    byCat.set(cat, (byCat.get(cat) ?? 0) + Number(line.qty));
  }

  const breakdown: DeliveryQuote["breakdown"] = [];
  let categoryDelivery = 0;
  for (const [category, qty] of byCat) {
    const perUnit =
      rateMap.get(category) ?? rateMap.get("*") ?? rateMap.get("OTHER") ?? 0;
    const lineDeliveryBdt =
      freeDelivery || !applyCategoryRates ? 0 : perUnit * qty;
    categoryDelivery += lineDeliveryBdt;
    breakdown.push({
      category,
      qty,
      chargePerUnitBdt: freeDelivery || !applyCategoryRates ? 0 : perUnit,
      lineDeliveryBdt,
    });
  }

  const deliveryBdt = freeDelivery
    ? 0
    : Math.max(0, baseCharge + categoryDelivery);

  let coupon: DeliveryQuote["coupon"] = null;
  let discountBdt = 0;
  const code = opts.couponCode?.trim().toUpperCase();
  if (code) {
    const c = await db.coupon.findFirst({
      where: { tenantId, code, isActive: true },
    });
    if (!c) {
      throw new Error("Invalid coupon code");
    }
    const now = new Date();
    if (c.startsAt && c.startsAt > now) throw new Error("Coupon not active yet");
    if (c.endsAt && c.endsAt < now) throw new Error("Coupon expired");
    if (c.usageLimit != null && c.usedCount >= c.usageLimit) {
      throw new Error("Coupon usage limit reached");
    }
    if (c.minOrderBdt != null && subtotalBdt < Number(c.minOrderBdt)) {
      throw new Error(
        `Coupon requires minimum order ৳${Number(c.minOrderBdt)}`,
      );
    }

    if (c.discountType === "PERCENT") {
      discountBdt = (subtotalBdt * Number(c.discountValue)) / 100;
    } else {
      discountBdt = Number(c.discountValue);
    }
    if (c.maxDiscountBdt != null) {
      discountBdt = Math.min(discountBdt, Number(c.maxDiscountBdt));
    }
    discountBdt = Math.min(Math.max(0, discountBdt), subtotalBdt);
    coupon = {
      id: c.id,
      code: c.code,
      discountType: c.discountType,
      discountValue: Number(c.discountValue),
    };
  }

  const totalBdt = Math.max(0, subtotalBdt - discountBdt + deliveryBdt);

  return {
    subtotalBdt: round2(subtotalBdt),
    deliveryBdt: round2(deliveryBdt),
    discountBdt: round2(discountBdt),
    totalBdt: round2(totalBdt),
    freeDelivery,
    zone,
    zoneLabel,
    ward,
    coupon,
    breakdown,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
