import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db.js";
import { verifyAccessToken, type AccessClaims } from "../lib/auth.js";

export type AuthUser = AccessClaims & {
  id: string;
  name: string;
  roleId: string;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ ok: false, message: "Missing access token" });
      return;
    }

    const token = header.slice("Bearer ".length).trim();
    const claims = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ ok: false, message: "User inactive or missing" });
      return;
    }

    if (user.tenantId) {
      const company = await prisma.company.findUnique({
        where: { id: user.tenantId },
        select: { isActive: true },
      });
      if (!company?.isActive && user.role.code !== "SUPER_ADMIN") {
        res.status(403).json({ ok: false, message: "Company disabled" });
        return;
      }
    }

    req.auth = {
      id: user.id,
      sub: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      roleCode: user.role.code,
      roleScope: user.role.scope,
      tenantId: user.tenantId,
    };
    next();
  } catch {
    res.status(401).json({ ok: false, message: "Invalid or expired token" });
  }
}

export function requireRoles(...codes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ ok: false, message: "Unauthorized" });
      return;
    }
    if (!codes.includes(req.auth.roleCode)) {
      res.status(403).json({
        ok: false,
        message: `Requires role: ${codes.join(" | ")}`,
      });
      return;
    }
    next();
  };
}

export function requireTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.tenantId) {
    res.status(403).json({ ok: false, message: "Tenant context required" });
    return;
  }
  next();
}
