import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import {
  requireCompanyStaff,
  requireOwnerOrManager,
} from "../middleware/companyAccess.js";

export const ownerMaterialsRouter = Router();
ownerMaterialsRouter.use(requireAuth, requireCompanyStaff);

function tid(req: { auth?: { tenantId: string | null } }) {
  return req.auth!.tenantId!;
}

function serializeMaterial(m: {
  id: string;
  name: string;
  nameBn: string | null;
  code: string | null;
  minStock: { toString(): string } | number | string | null;
  isActive: boolean;
  kind: { code: string; nameEn: string; nameBn: string };
  unit: { code: string; nameEn: string; nameBn: string };
  _count?: { purchases: number };
}) {
  return {
    id: m.id,
    name: m.name,
    nameBn: m.nameBn,
    code: m.code,
    minStock: m.minStock == null ? null : Number(m.minStock),
    isActive: m.isActive,
    kind: {
      code: m.kind.code,
      nameEn: m.kind.nameEn,
      nameBn: m.kind.nameBn,
    },
    unit: {
      code: m.unit.code,
      nameEn: m.unit.nameEn,
      nameBn: m.unit.nameBn,
    },
    purchaseCount: m._count?.purchases ?? 0,
  };
}

const materialSchema = z.object({
  name: z.string().min(2).max(160),
  nameBn: z.string().max(160).nullable().optional(),
  code: z.string().max(32).nullable().optional(),
  kindCode: z.enum([
    "RAW_MATERIAL",
    "BOTTLE",
    "ACID",
    "CAP",
    "LABEL",
    "OTHER",
  ]),
  unitCode: z.enum([
    "LITER",
    "BOTTLE",
    "DRUM",
    "PIECE",
    "KG",
    "PACK",
    "CAN",
  ]),
  minStock: z.coerce.number().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
});

async function resolveKindUnit(data: {
  kindCode: string;
  unitCode: string;
}) {
  const [kind, unit] = await Promise.all([
    prisma.supplyKindLookup.findUnique({ where: { code: data.kindCode } }),
    prisma.unitLookup.findUnique({ where: { code: data.unitCode } }),
  ]);
  if (!kind?.isActive || !unit?.isActive) {
    throw new Error("Unknown supply kind or unit");
  }
  return { kind, unit };
}

function normalizeCode(code: string | null | undefined) {
  const trimmed = code?.trim().toUpperCase();
  return trimmed ? trimmed : null;
}

ownerMaterialsRouter.get("/materials", async (req, res) => {
  const activeOnly = req.query.active === "1" || req.query.active === "true";
  const materials = await prisma.material.findMany({
    where: {
      tenantId: tid(req),
      ...(activeOnly ? { isActive: true } : {}),
    },
    include: {
      kind: true,
      unit: true,
      _count: { select: { purchases: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  res.json({
    ok: true,
    materials: materials.map(serializeMaterial),
  });
});

ownerMaterialsRouter.post(
  "/materials",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = materialSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }
    try {
      const { kind, unit } = await resolveKindUnit(parsed.data);
      const code = normalizeCode(parsed.data.code);
      const material = await prisma.material.create({
        data: {
          tenantId: tid(req),
          name: parsed.data.name.trim(),
          nameBn: parsed.data.nameBn?.trim() || null,
          code,
          kindId: kind.id,
          unitId: unit.id,
          minStock: parsed.data.minStock ?? null,
          isActive: parsed.data.isActive ?? true,
          createdBy: req.auth!.id,
          updatedBy: req.auth!.id,
        },
        include: { kind: true, unit: true },
      });
      res.status(201).json({
        ok: true,
        material: serializeMaterial({ ...material, _count: { purchases: 0 } }),
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        message: err instanceof Error ? err.message : "Create failed",
      });
    }
  },
);

ownerMaterialsRouter.patch(
  "/materials/:id",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = materialSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }
    const existing = await prisma.material.findFirst({
      where: { id: String(req.params.id), tenantId: tid(req) },
    });
    if (!existing) {
      res.status(404).json({ ok: false, message: "Material not found" });
      return;
    }
    try {
      let kindId = existing.kindId;
      let unitId = existing.unitId;
      if (parsed.data.kindCode || parsed.data.unitCode) {
        const { kind, unit } = await resolveKindUnit({
          kindCode:
            parsed.data.kindCode ??
            (await prisma.supplyKindLookup.findUniqueOrThrow({
              where: { id: existing.kindId },
            })).code,
          unitCode:
            parsed.data.unitCode ??
            (await prisma.unitLookup.findUniqueOrThrow({
              where: { id: existing.unitId },
            })).code,
        });
        if (parsed.data.kindCode) kindId = kind.id;
        if (parsed.data.unitCode) unitId = unit.id;
      }
      const material = await prisma.material.update({
        where: { id: existing.id },
        data: {
          name: parsed.data.name?.trim(),
          nameBn:
            parsed.data.nameBn === undefined
              ? undefined
              : parsed.data.nameBn?.trim() || null,
          code:
            parsed.data.code === undefined
              ? undefined
              : normalizeCode(parsed.data.code),
          kindId,
          unitId,
          minStock:
            parsed.data.minStock === undefined
              ? undefined
              : parsed.data.minStock,
          isActive: parsed.data.isActive,
          updatedBy: req.auth!.id,
        },
        include: {
          kind: true,
          unit: true,
          _count: { select: { purchases: true } },
        },
      });
      res.json({ ok: true, material: serializeMaterial(material) });
    } catch (err) {
      res.status(400).json({
        ok: false,
        message: err instanceof Error ? err.message : "Update failed",
      });
    }
  },
);
