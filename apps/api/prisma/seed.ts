import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for seeding");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const company = await prisma.company.upsert({
    where: { slug: "ananta-water" },
    update: {},
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

  const branchId = company.branches[0]?.id;

  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: company.id,
        email: "owner@anantaone.local",
      },
    },
    update: {},
    create: {
      tenantId: company.id,
      branchId,
      email: "owner@anantaone.local",
      name: "Owner",
      phone: "01700000000",
      // bcrypt hash placeholder — replace when auth lands
      passwordHash: "dev-only-change-me",
      role: "OWNER",
    },
  });

  await prisma.buyer.upsert({
    where: {
      tenantId_phone: {
        tenantId: company.id,
        phone: "01800000000",
      },
    },
    update: {},
    create: {
      tenantId: company.id,
      shopName: "Demo Shop",
      phone: "01800000000",
      address: "Lakshmipur Bazaar",
      locale: "bn",
    },
  });

  console.log("Seeded company:", company.slug);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
