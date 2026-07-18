import type { Request } from "express";

export type BranchScope = {
  /** Active branch filter. `null` means all branches (owner only). */
  branchId: string | null;
  mode: "all" | "one";
  /** User's permanently assigned home branch. */
  assignedBranchId: string | null;
  roleCode: string;
};

/**
 * Resolve which branch data the caller may see.
 * - OWNER: optional `X-Branch-Id` header (`all` / empty = company-wide)
 * - MANAGER / EMPLOYEE: locked to their assigned `User.branchId`
 */
export function resolveBranchScope(req: Request): BranchScope {
  const roleCode = req.auth!.roleCode;
  const assignedBranchId = req.auth!.branchId ?? null;

  if (roleCode === "OWNER") {
    const raw = req.header("x-branch-id")?.trim() ?? "";
    if (!raw || raw === "all") {
      return {
        branchId: null,
        mode: "all",
        assignedBranchId,
        roleCode,
      };
    }
    return {
      branchId: raw,
      mode: "one",
      assignedBranchId,
      roleCode,
    };
  }

  return {
    branchId: assignedBranchId,
    mode: "one",
    assignedBranchId,
    roleCode,
  };
}

/** Prisma `where` fragment for SalesOrder (and similar) branch filtering. */
export function branchFilter(
  scope: BranchScope,
): { branchId: string } | { branchId: { in: string[] } } | { id: string } | Record<string, never> {
  if (scope.mode === "all") return {};
  if (scope.branchId) return { branchId: scope.branchId };
  // Staff with no assigned branch — see nothing branch-scoped
  return { id: "__no_branch__" };
}

export function canAccessBranch(
  scope: BranchScope,
  orderBranchId: string | null | undefined,
): boolean {
  if (scope.mode === "all") return true;
  if (!scope.branchId) return false;
  return orderBranchId === scope.branchId;
}
