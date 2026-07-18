import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import {
  requireCompanyStaff,
  requireOwnerOnly,
  requireOwnerOrManager,
} from "../middleware/companyAccess.js";

export const ownerBranchesRouter = Router();

ownerBranchesRouter.use(requireAuth, requireCompanyStaff);

function tid(req: { auth?: { tenantId: string | null } }) {
  return req.auth!.tenantId!;
}

function serializeStaffBrief(user: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  role: { code: string; nameEn: string; nameBn: string };
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    isActive: user.isActive,
    role: {
      code: user.role.code,
      nameEn: user.role.nameEn,
      nameBn: user.role.nameBn,
    },
  };
}

function serializeBranch(branch: {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  managerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  manager: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    role: { code: string; nameEn: string; nameBn: string };
  } | null;
  users: Array<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    role: { code: string; nameEn: string; nameBn: string };
  }>;
}) {
  const staff = branch.users.map(serializeStaffBrief);
  return {
    id: branch.id,
    name: branch.name,
    address: branch.address,
    phone: branch.phone,
    isActive: branch.isActive,
    managerId: branch.managerId,
    manager: branch.manager ? serializeStaffBrief(branch.manager) : null,
    staff,
    employees: staff.filter((u) => u.role.code === "EMPLOYEE"),
    managers: staff.filter((u) => u.role.code === "MANAGER"),
    createdAt: branch.createdAt,
    updatedAt: branch.updatedAt,
  };
}

const branchInclude = {
  manager: { include: { role: true } },
  users: {
    where: { role: { code: { in: ["MANAGER", "EMPLOYEE"] } } },
    include: { role: true },
    orderBy: [{ isActive: "desc" as const }, { name: "asc" as const }],
  },
};

ownerBranchesRouter.get("/branches", requireOwnerOrManager, async (req, res) => {
  const branches = await prisma.branch.findMany({
    where: { tenantId: tid(req) },
    include: branchInclude,
    orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
  });
  res.json({ ok: true, branches: branches.map(serializeBranch) });
});

const branchCreateSchema = z.object({
  name: z.string().min(2).max(120),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(32).nullable().optional(),
  managerId: z.string().cuid().nullable().optional(),
  employeeIds: z.array(z.string().cuid()).optional(),
});

ownerBranchesRouter.post("/branches", requireOwnerOnly, async (req, res) => {
  const parsed = branchCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: parsed.error.message });
    return;
  }

  const tenantId = tid(req);
  const { name, address, phone, managerId, employeeIds } = parsed.data;

  if (managerId) {
    const manager = await prisma.user.findFirst({
      where: {
        id: managerId,
        tenantId,
        isActive: true,
        role: { code: { in: ["MANAGER", "EMPLOYEE"] } },
      },
      include: { role: true },
    });
    if (!manager) {
      res.status(400).json({ ok: false, message: "Manager not found in company" });
      return;
    }
  }

  if (employeeIds?.length) {
    const count = await prisma.user.count({
      where: {
        id: { in: employeeIds },
        tenantId,
        role: { code: { in: ["MANAGER", "EMPLOYEE"] } },
      },
    });
    if (count !== employeeIds.length) {
      res.status(400).json({ ok: false, message: "One or more employees not found" });
      return;
    }
  }

  try {
    const branch = await prisma.$transaction(async (tx) => {
      let resolvedManagerId = managerId ?? null;
      if (resolvedManagerId) {
        const managerRole = await tx.roleLookup.findUnique({
          where: { code: "MANAGER" },
        });
        if (managerRole) {
          await tx.user.update({
            where: { id: resolvedManagerId },
            data: {
              roleId: managerRole.id,
              updatedBy: req.auth!.id,
            },
          });
        }
      }

      const created = await tx.branch.create({
        data: {
          tenantId,
          name: name.trim(),
          address: address ?? null,
          phone: phone ?? null,
          managerId: resolvedManagerId,
        },
      });

      const assignIds = new Set<string>();
      if (resolvedManagerId) assignIds.add(resolvedManagerId);
      for (const id of employeeIds ?? []) assignIds.add(id);

      if (assignIds.size > 0) {
        await tx.user.updateMany({
          where: { id: { in: [...assignIds] }, tenantId },
          data: { branchId: created.id, updatedBy: req.auth!.id },
        });
      }

      return tx.branch.findUniqueOrThrow({
        where: { id: created.id },
        include: branchInclude,
      });
    });

    res.status(201).json({ ok: true, branch: serializeBranch(branch) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "create failed";
    res.status(400).json({ ok: false, message });
  }
});

const branchUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(32).nullable().optional(),
  isActive: z.boolean().optional(),
  managerId: z.string().cuid().nullable().optional(),
  employeeIds: z.array(z.string().cuid()).optional(),
});

ownerBranchesRouter.patch(
  "/branches/:id",
  requireOwnerOnly,
  async (req, res) => {
    const parsed = branchUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }

    const tenantId = tid(req);
    const id = String(req.params.id);
    const existing = await prisma.branch.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      res.status(404).json({ ok: false, message: "Branch not found" });
      return;
    }

    const { managerId, employeeIds, ...rest } = parsed.data;

    if (managerId) {
      const manager = await prisma.user.findFirst({
        where: {
          id: managerId,
          tenantId,
          isActive: true,
          role: { code: { in: ["MANAGER", "EMPLOYEE"] } },
        },
      });
      if (!manager) {
        res
          .status(400)
          .json({ ok: false, message: "Manager not found in company" });
        return;
      }
    }

    if (employeeIds) {
      const count = await prisma.user.count({
        where: {
          id: { in: employeeIds },
          tenantId,
          role: { code: { in: ["MANAGER", "EMPLOYEE"] } },
        },
      });
      if (count !== employeeIds.length) {
        res
          .status(400)
          .json({ ok: false, message: "One or more employees not found" });
        return;
      }
    }

    try {
      const branch = await prisma.$transaction(async (tx) => {
        if (managerId) {
          const managerRole = await tx.roleLookup.findUnique({
            where: { code: "MANAGER" },
          });
          if (managerRole) {
            await tx.user.update({
              where: { id: managerId },
              data: {
                roleId: managerRole.id,
                branchId: id,
                updatedBy: req.auth!.id,
              },
            });
          }
        } else if (managerId === null && existing.managerId) {
          // Clear designation only; keep user on branch unless reassigned below.
        }

        await tx.branch.update({
          where: { id },
          data: {
            ...rest,
            ...(managerId !== undefined ? { managerId } : {}),
          },
        });

        if (employeeIds) {
          const keepIds = new Set(employeeIds);
          if (managerId) keepIds.add(managerId);
          else if (managerId === undefined && existing.managerId) {
            keepIds.add(existing.managerId);
          }

          await tx.user.updateMany({
            where: {
              tenantId,
              branchId: id,
              role: { code: { in: ["MANAGER", "EMPLOYEE"] } },
              id: { notIn: [...keepIds] },
            },
            data: { branchId: null, updatedBy: req.auth!.id },
          });

          if (keepIds.size > 0) {
            await tx.user.updateMany({
              where: { id: { in: [...keepIds] }, tenantId },
              data: { branchId: id, updatedBy: req.auth!.id },
            });
          }
        } else if (managerId) {
          await tx.user.update({
            where: { id: managerId },
            data: { branchId: id, updatedBy: req.auth!.id },
          });
        }

        return tx.branch.findUniqueOrThrow({
          where: { id },
          include: branchInclude,
        });
      });

      res.json({ ok: true, branch: serializeBranch(branch) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "update failed";
      res.status(400).json({ ok: false, message });
    }
  },
);

ownerBranchesRouter.delete(
  "/branches/:id",
  requireOwnerOnly,
  async (req, res) => {
    const tenantId = tid(req);
    const id = String(req.params.id);
    const existing = await prisma.branch.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      res.status(404).json({ ok: false, message: "Branch not found" });
      return;
    }

    const activeCount = await prisma.branch.count({
      where: { tenantId, isActive: true },
    });
    if (existing.isActive && activeCount <= 1) {
      res.status(400).json({
        ok: false,
        message: "Cannot deactivate the only active branch",
      });
      return;
    }

    const branch = await prisma.$transaction(async (tx) => {
      await tx.user.updateMany({
        where: { tenantId, branchId: id },
        data: { branchId: null, updatedBy: req.auth!.id },
      });
      return tx.branch.update({
        where: { id },
        data: { isActive: false, managerId: null },
        include: branchInclude,
      });
    });

    res.json({ ok: true, branch: serializeBranch(branch) });
  },
);
