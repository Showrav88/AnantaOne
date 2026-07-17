import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

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
    unit: "BOTTLE" as const,
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
    unit: "DRUM" as const,
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
    unit: "BOTTLE" as const,
    priceBdt: 18,
    stockQty: 12,
    minStock: 100,
    description: "Low stock demo SKU",
  },
] as const;

async function main() {
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

  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: company.id,
        email: "owner@anantaone.local",
      },
    },
    update: {
      name: "Owner",
      phone: "01700000000",
      role: "OWNER",
      branchId,
    },
    create: {
      tenantId: company.id,
      branchId,
      email: "owner@anantaone.local",
      name: "Owner",
      phone: "01700000000",
      passwordHash: "dev-only-change-me",
      role: "OWNER",
    },
  });

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
        unit: product.unit,
        priceBdt: product.priceBdt,
        stockQty: product.stockQty,
        minStock: product.minStock,
        description: product.description,
        isActive: true,
      },
      create: {
        tenantId: company.id,
        ...product,
      },
    });
  }

  console.log(
    `Seeded company=${company.slug} shops=${mockShops.length} products=${mockProducts.length}`,
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
