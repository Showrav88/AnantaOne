import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRoles } from "../middleware/auth.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRoles("SUPER_ADMIN"));

adminRouter.get("/dashboard", async (_req, res) => {
  const [companies, users, buyers, products] = await Promise.all([
    prisma.company.count(),
    prisma.user.count({ where: { role: { code: { not: "SUPER_ADMIN" } } } }),
    prisma.buyer.count(),
    prisma.product.count(),
  ]);

  res.json({
    ok: true,
    dashboard: {
      stats: { companies, users, buyers, products },
    },
  });
});

adminRouter.get("/companies", async (_req, res) => {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true, buyers: true, products: true } },
      users: {
        where: { role: { code: "OWNER" } },
        take: 1,
        select: { id: true, name: true, email: true, phone: true },
      },
    },
  });

  res.json({
    ok: true,
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      phone: c.phone,
      address: c.address,
      locale: c.locale,
      isActive: c.isActive,
      createdAt: c.createdAt,
      counts: c._count,
      owner: c.users[0] ?? null,
    })),
  });
});

adminRouter.patch("/companies/:id", async (req, res) => {
  const id = String(req.params.id);
  const parsed = z
    .object({
      isActive: z.boolean().optional(),
      name: z.string().min(2).max(120).optional(),
      phone: z.string().max(32).nullable().optional(),
      address: z.string().max(240).nullable().optional(),
    })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ ok: false, message: parsed.error.message });
    return;
  }

  const company = await prisma.company.update({
    where: { id },
    data: parsed.data,
    include: {
      _count: { select: { users: true, buyers: true, products: true } },
    },
  });

  res.json({
    ok: true,
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      isActive: company.isActive,
      phone: company.phone,
      address: company.address,
      counts: company._count,
    },
  });
});

adminRouter.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { role: { code: { not: "SUPER_ADMIN" } } },
    include: {
      role: true,
      company: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  res.json({
    ok: true,
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      isActive: u.isActive,
      role: {
        code: u.role.code,
        nameEn: u.role.nameEn,
        nameBn: u.role.nameBn,
      },
      company: u.company,
    })),
  });
});
