import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db.js";

export type OwnerContext = {
  tenantId: string;
  role: "OWNER" | "MANAGER";
  companySlug: string;
};

declare global {
  namespace Express {
    interface Request {
      owner?: OwnerContext;
    }
  }
}

/**
 * Temporary owner context until JWT auth lands.
 * Uses first company (seeded Ananta Water). Optional header:
 *   X-Demo-Role: OWNER | MANAGER
 */
export async function attachOwnerContext(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const company = await prisma.company.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, slug: true },
    });

    if (!company) {
      res.status(404).json({
        ok: false,
        message: "No company found. Run migrations + seed.",
      });
      return;
    }

    const roleHeader = (req.header("x-demo-role") ?? "OWNER").toUpperCase();
    const role = roleHeader === "MANAGER" ? "MANAGER" : "OWNER";

    req.owner = {
      tenantId: company.id,
      role,
      companySlug: company.slug,
    };
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    res.status(500).json({ ok: false, message });
  }
}

export function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (req.owner?.role !== "OWNER") {
    res.status(403).json({
      ok: false,
      message: "Owner role required for this action.",
    });
    return;
  }
  next();
}
