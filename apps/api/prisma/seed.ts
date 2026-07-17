import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for seeding");
}

const needsSsl =
  connectionString.includes("sslmode=require") ||
  connectionString.includes("render.com") ||
  connectionString.includes("neon.tech") ||
  process.env.NODE_ENV === "production";

const adapter = new PrismaPg({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});
const prisma = new PrismaClient({ adapter });

const mockShops = [
  {
    shopName: "লক্ষ্মীপুর বাজার স্টোর",
    phone: "01800000001",
    address: "Lakshmipur Bazaar, Main Road",
  },
  {
    shopName: "চন্দ্রগঞ্জ ওয়াটার পয়েন্ট",
    phone: "01800000002",
    address: "Chandraganj Bazar",
  },
  {
    shopName: "রায়পুর ট্রেডিং",
    phone: "01800000003",
    address: "Raipur Bus Stand",
  },
  {
    shopName: "রামগঞ্জ সুপার শপ",
    phone: "01800000004",
    address: "Ramganj Zero Point",
  },
  {
    shopName: "Demo Shop",
    phone: "01800000000",
    address: "Lakshmipur Bazaar",
  },
] as const;

const mockProducts = [
  {
    name: "Battery Water 1L",
    nameBn: "ব্যাটারি ওয়াটার ১ লিটার",
    sku: "BW-1L",
    category: "water",
    unitCode: "BOTTLE",
    priceBdt: 35,
    stockQty: 420,
    minStock: 80,
    description: "Mineral-mixed battery water",
  },
  {
    name: "Drinking Water 20L",
    nameBn: "পানীয় জল ২০ লিটার",
    sku: "DW-20L",
    category: "water",
    unitCode: "DRUM",
    priceBdt: 90,
    stockQty: 65,
    minStock: 30,
    description: "R/O drinking water jar",
  },
  {
    name: "Drinking Water 500ml",
    nameBn: "পানীয় জল ৫০০ মি.লি.",
    sku: "DW-500",
    category: "water",
    unitCode: "BOTTLE",
    priceBdt: 18,
    stockQty: 12,
    minStock: 100,
    description: "Low stock demo SKU",
  },
] as const;

async function main() {
  const roles = await prisma.roleLookup.findMany();
  const units = await prisma.unitLookup.findMany();
  const walletTypes = await prisma.walletTxnTypeLookup.findMany();
  if (roles.length === 0 || units.length === 0 || walletTypes.length === 0) {
    throw new Error("Lookups missing — run migrations first");
  }

  const byRole = Object.fromEntries(roles.map((r) => [r.code, r]));
  const byUnit = Object.fromEntries(units.map((u) => [u.code, u]));

  const superEmail = (
    process.env.SUPER_ADMIN_EMAIL ?? "superadmin@anantaone.local"
  ).toLowerCase();
  const superPassword = process.env.SUPER_ADMIN_PASSWORD ?? "SuperAdmin#2026";

  await prisma.user.upsert({
    where: { email: superEmail },
    update: {
      name: "SaaS Super Admin",
      roleId: byRole.SUPER_ADMIN!.id,
      tenantId: null,
      isActive: true,
      passwordHash: await hashPassword(superPassword),
    },
    create: {
      email: superEmail,
      name: "SaaS Super Admin",
      phone: "01700000099",
      tenantId: null,
      roleId: byRole.SUPER_ADMIN!.id,
      passwordHash: await hashPassword(superPassword),
    },
  });

  const company = await prisma.company.upsert({
    where: { slug: "ananta-water" },
    update: {
      name: "Ananta Water",
      locale: "bn",
      phone: "01700000000",
      address: "Lakshmipur, Bangladesh",
      tagline: "বাংলাদেশের পালস — দোকান, স্টক ও ডেলিভারি",
      description:
        "Distilled / R/O water production and B2B distribution for Lakshmipur shops.",
      isActive: true,
    },
    create: {
      name: "Ananta Water",
      slug: "ananta-water",
      locale: "bn",
      phone: "01700000000",
      address: "Lakshmipur, Bangladesh",
      tagline: "বাংলাদেশের পালস — দোকান, স্টক ও ডেলিভারি",
      description:
        "Distilled / R/O water production and B2B distribution for Lakshmipur shops.",
      branches: {
        create: {
          name: "Lakshmipur HQ",
          address: "Lakshmipur, Bangladesh",
        },
      },
    },
    include: { branches: true },
  });

  let branchId = company.branches[0]?.id;
  if (!branchId) {
    const branch = await prisma.branch.create({
      data: {
        tenantId: company.id,
        name: "Lakshmipur HQ",
        address: "Lakshmipur, Bangladesh",
      },
    });
    branchId = branch.id;
  }

  const ownerEmail = "owner@anantaone.local";
  await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {
      name: "Owner",
      phone: "01700000000",
      roleId: byRole.OWNER!.id,
      tenantId: company.id,
      branchId,
      passwordHash: await hashPassword("Owner#2026"),
      isActive: true,
      joiningDate: new Date("2024-01-01"),
      designation: "Owner",
    },
    create: {
      tenantId: company.id,
      branchId,
      email: ownerEmail,
      name: "Owner",
      phone: "01700000000",
      passwordHash: await hashPassword("Owner#2026"),
      roleId: byRole.OWNER!.id,
      joiningDate: new Date("2024-01-01"),
      designation: "Owner",
    },
  });

  await prisma.user.upsert({
    where: { email: "manager@anantaone.local" },
    update: {
      name: "Demo Manager",
      phone: "01700000012",
      roleId: byRole.MANAGER!.id,
      tenantId: company.id,
      branchId,
      passwordHash: await hashPassword("Manager#2026"),
      isActive: true,
      employeeCode: "MGR-01",
      designation: "Branch Manager",
      joiningDate: new Date("2025-03-01"),
      salaryBdt: 25000,
    },
    create: {
      tenantId: company.id,
      branchId,
      email: "manager@anantaone.local",
      name: "Demo Manager",
      phone: "01700000012",
      passwordHash: await hashPassword("Manager#2026"),
      roleId: byRole.MANAGER!.id,
      employeeCode: "MGR-01",
      designation: "Branch Manager",
      joiningDate: new Date("2025-03-01"),
      salaryBdt: 25000,
    },
  });

  await prisma.user.upsert({
    where: { email: "employee@anantaone.local" },
    update: {
      name: "Demo Employee",
      phone: "01700000011",
      roleId: byRole.EMPLOYEE!.id,
      tenantId: company.id,
      branchId,
      passwordHash: await hashPassword("Employee#2026"),
      isActive: true,
      employeeCode: "EMP-01",
      designation: "Delivery",
      joiningDate: new Date("2025-06-15"),
      salaryBdt: 15000,
    },
    create: {
      tenantId: company.id,
      branchId,
      email: "employee@anantaone.local",
      name: "Demo Employee",
      phone: "01700000011",
      passwordHash: await hashPassword("Employee#2026"),
      roleId: byRole.EMPLOYEE!.id,
      employeeCode: "EMP-01",
      designation: "Delivery",
      joiningDate: new Date("2025-06-15"),
      salaryBdt: 15000,
    },
  });

  const wallet = await prisma.cashWallet.upsert({
    where: { tenantId: company.id },
    update: {},
    create: { tenantId: company.id, balanceBdt: 0 },
  });

  const openingType = await prisma.walletTxnTypeLookup.findUnique({
    where: { code: "OPENING" },
  });
  if (openingType) {
    const hasOpening = await prisma.cashTransaction.findFirst({
      where: { tenantId: company.id, typeId: openingType.id },
    });
    if (!hasOpening) {
      const openingAmount = 50000;
      await prisma.$transaction(async (tx) => {
        await tx.cashWallet.update({
          where: { id: wallet.id },
          data: { balanceBdt: openingAmount },
        });
        await tx.cashTransaction.create({
          data: {
            tenantId: company.id,
            walletId: wallet.id,
            typeId: openingType.id,
            amountBdt: openingAmount,
            balanceAfter: openingAmount,
            note: "Seed opening cash drawer",
            occurredAt: new Date("2026-01-01"),
          },
        });
      });
    }
  }

  for (const shop of mockShops) {
    await prisma.buyer.upsert({
      where: {
        tenantId_phone: {
          tenantId: company.id,
          phone: shop.phone,
        },
      },
      update: {
        shopName: shop.shopName,
        address: shop.address,
        locale: "bn",
        isActive: true,
      },
      create: {
        tenantId: company.id,
        shopName: shop.shopName,
        phone: shop.phone,
        address: shop.address,
        locale: "bn",
      },
    });
  }

  for (const product of mockProducts) {
    const unit = byUnit[product.unitCode]!;
    await prisma.product.upsert({
      where: {
        tenantId_sku: {
          tenantId: company.id,
          sku: product.sku,
        },
      },
      update: {
        name: product.name,
        nameBn: product.nameBn,
        category: product.category,
        unitId: unit.id,
        priceBdt: product.priceBdt,
        stockQty: product.stockQty,
        minStock: product.minStock,
        description: product.description,
        isActive: true,
      },
      create: {
        tenantId: company.id,
        name: product.name,
        nameBn: product.nameBn,
        sku: product.sku,
        category: product.category,
        unitId: unit.id,
        priceBdt: product.priceBdt,
        stockQty: product.stockQty,
        minStock: product.minStock,
        description: product.description,
      },
    });
  }

  console.log("Seeded:");
  console.log(`  super admin: ${superEmail} / ${superPassword}`);
  console.log("  owner: owner@anantaone.local / Owner#2026");
  console.log("  manager: manager@anantaone.local / Manager#2026");
  console.log("  employee: employee@anantaone.local / Employee#2026");
  console.log(
    `  company=${company.slug} shops=${mockShops.length} products=${mockProducts.length}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
