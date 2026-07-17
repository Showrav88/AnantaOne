import type { NextFunction, Request, Response } from "express";

/**
 * Tenant workspace access for OWNER / MANAGER / EMPLOYEE.
 * OWNER: full write. MANAGER: write products/company limited later. EMPLOYEE: read-heavy.
 */
export function requireCompanyStaff(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const role = req.auth?.roleCode;
  if (!role || !["OWNER", "MANAGER", "EMPLOYEE"].includes(role)) {
    res.status(403).json({ ok: false, message: "Company staff only" });
    return;
  }
  if (!req.auth?.tenantId) {
    res.status(403).json({ ok: false, message: "No company on this account" });
    return;
  }
  next();
}

export function requireOwnerOrManager(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const role = req.auth?.roleCode;
  if (!role || !["OWNER", "MANAGER"].includes(role)) {
    res.status(403).json({ ok: false, message: "Owner or manager required" });
    return;
  }
  next();
}

export function requireOwnerOnly(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.auth?.roleCode !== "OWNER") {
    res.status(403).json({ ok: false, message: "Owner role required" });
    return;
  }
  next();
}
