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

async function main() {
  const company = await prisma.company.upsert({
    where: { slug: "ananta-water" },
    update: {
      name: "Ananta Water",
      locale: "bn",
    },
    create: {
      name: "Ananta Water",
      slug: "ananta-water",
      locale: "bn",
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

  console.log(
    `Seeded company=${company.slug} shops=${mockShops.length} branch=${branchId}`,
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
