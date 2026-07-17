import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import {
  createRefreshTokenValue,
  hashPassword,
  hashToken,
  REFRESH_TOKEN_TTL_DAYS,
  signAccessToken,
  signRefreshToken,
  slugifyCompanyName,
  verifyPassword,
  verifyRefreshToken,
} from "../lib/auth.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const registerSchema = z.object({
  companyName: z.string().min(2).max(120),
  ownerName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(32).optional(),
  password: z.string().min(8).max(100),
  locale: z.enum(["bn", "en"]).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
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

  const ownerRole = await prisma.roleLookup.findUnique({
    where: { code: "OWNER" },
  });
  if (!ownerRole) {
    res.status(500).json({ ok: false, message: "OWNER role missing — run seed" });
    return;
  }

  let slug = slugifyCompanyName(data.companyName);
  const slugTaken = await prisma.company.findUnique({ where: { slug } });
  if (slugTaken) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const passwordHash = await hashPassword(data.password);

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: data.companyName,
        slug,
        locale: data.locale ?? "bn",
        phone: data.phone ?? null,
        branches: {
          create: {
            name: "Main branch",
            address: null,
          },
        },
      },
      include: { branches: true },
    });

    const user = await tx.user.create({
      data: {
        tenantId: company.id,
        branchId: company.branches[0]?.id,
        email,
        phone: data.phone ?? null,
        name: data.ownerName,
        passwordHash,
        roleId: ownerRole.id,
      },
      include: { role: true },
    });

    return { company, user };
  });

  const tokens = await issueTokens(result.user.id, {
    email: result.user.email,
    roleCode: result.user.role.code,
    roleScope: result.user.role.scope,
    tenantId: result.user.tenantId,
  });

  res.status(201).json({
    ok: true,
    user: publicUser(result.user),
    company: {
      id: result.company.id,
      name: result.company.name,
      slug: result.company.slug,
    },
    ...tokens,
  });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: parsed.error.message });
    return;
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true, company: true },
  });

  if (!user || !user.isActive) {
    res.status(401).json({ ok: false, message: "Invalid email or password" });
    return;
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ ok: false, message: "Invalid email or password" });
    return;
  }

  if (user.role.code !== "SUPER_ADMIN" && user.company && !user.company.isActive) {
    res.status(403).json({ ok: false, message: "Company disabled by platform" });
    return;
  }

  const tokens = await issueTokens(user.id, {
    email: user.email,
    roleCode: user.role.code,
    roleScope: user.role.scope,
    tenantId: user.tenantId,
  });

  res.json({
    ok: true,
    user: publicUser(user),
    company: user.company
      ? { id: user.company.id, name: user.company.name, slug: user.company.slug }
      : null,
    ...tokens,
  });
});

authRouter.post("/refresh", async (req, res) => {
  const refreshToken = z.string().min(10).safeParse(req.body?.refreshToken);
  if (!refreshToken.success) {
    res.status(400).json({ ok: false, message: "refreshToken required" });
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken.data);
    const tokenHash = hashToken(refreshToken.data);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { role: true, company: true } } },
    });

    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt < new Date() ||
      stored.userId !== payload.sub
    ) {
      res.status(401).json({ ok: false, message: "Invalid refresh token" });
      return;
    }

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = stored.user;
    if (!user.isActive) {
      res.status(401).json({ ok: false, message: "User inactive" });
      return;
    }

    const tokens = await issueTokens(user.id, {
      email: user.email,
      roleCode: user.role.code,
      roleScope: user.role.scope,
      tenantId: user.tenantId,
    });

    res.json({
      ok: true,
      user: publicUser(user),
      company: user.company
        ? {
            id: user.company.id,
            name: user.company.name,
            slug: user.company.slug,
          }
        : null,
      ...tokens,
    });
  } catch {
    res.status(401).json({ ok: false, message: "Invalid refresh token" });
  }
});

authRouter.post("/logout", requireAuth, async (req, res) => {
  const refreshToken = z.string().optional().safeParse(req.body?.refreshToken);
  if (refreshToken.success && refreshToken.data) {
    await prisma.refreshToken.updateMany({
      where: {
        userId: req.auth!.id,
        tokenHash: hashToken(refreshToken.data),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  } else {
    await prisma.refreshToken.updateMany({
      where: { userId: req.auth!.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.auth!.id },
    include: { role: true, company: true },
  });

  res.json({
    ok: true,
    user: publicUser(user),
    company: user.company
      ? {
          id: user.company.id,
          name: user.company.name,
          slug: user.company.slug,
          isActive: user.company.isActive,
        }
      : null,
  });
});

authRouter.get("/lookups/roles", async (_req, res) => {
  const roles = await prisma.roleLookup.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  res.json({ ok: true, roles });
});

authRouter.get("/lookups/units", async (_req, res) => {
  const units = await prisma.unitLookup.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  res.json({ ok: true, units });
});

function publicUser(user: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  tenantId: string | null;
  role: { code: string; nameEn: string; nameBn: string; scope: string };
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    tenantId: user.tenantId,
    role: {
      code: user.role.code,
      nameEn: user.role.nameEn,
      nameBn: user.role.nameBn,
      scope: user.role.scope,
    },
  };
}

async function issueTokens(
  userId: string,
  claims: {
    email: string;
    roleCode: string;
    roleScope: string;
    tenantId: string | null;
  },
) {
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  const stored = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(createRefreshTokenValue()),
      expiresAt,
    },
  });

  const accessToken = signAccessToken({
    sub: userId,
    email: claims.email,
    roleCode: claims.roleCode,
    roleScope: claims.roleScope,
    tenantId: claims.tenantId,
  });

  const refreshToken = signRefreshToken(userId, stored.id);

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { tokenHash: hashToken(refreshToken) },
  });

  return {
    accessToken,
    refreshToken,
    tokenType: "Bearer",
    expiresIn: ACCESS_HINT,
  };
}

const ACCESS_HINT = 8 * 60 * 60;
