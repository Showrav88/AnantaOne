import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";

type TxClient = Prisma.TransactionClient;

export type BomLineInput = { materialId: string; qty: number };

function serializeBomMaterial(m: {
  id: string;
  name: string;
  nameBn: string | null;
  code: string | null;
  kind: { code: string; nameEn: string; nameBn: string };
  unit: { code: string; nameEn: string; nameBn: string };
}) {
  return {
    id: m.id,
    name: m.name,
    nameBn: m.nameBn,
    code: m.code,
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
  };
}

export function serializeBomLine(line: {
  id: string;
  materialId: string;
  qty: { toString(): string } | number | string;
  sortOrder: number;
  material: {
    id: string;
    name: string;
    nameBn: string | null;
    code: string | null;
    kind: { code: string; nameEn: string; nameBn: string };
    unit: { code: string; nameEn: string; nameBn: string };
  };
  source?: "direct" | "inner";
}) {
  return {
    id: line.id,
    materialId: line.materialId,
    qty: Number(line.qty),
    sortOrder: line.sortOrder,
    source: line.source ?? "direct",
    material: serializeBomMaterial(line.material),
  };
}

const lineInclude = {
  material: { include: { kind: true, unit: true } },
} as const;

export async function validatePackLink(opts: {
  tenantId: string;
  productId?: string;
  packType: string;
  innerProductId?: string | null;
  unitsPerPack?: number | null;
}) {
  if (opts.packType === "BOX") {
    if (opts.unitsPerPack != null) {
      if (!Number.isInteger(opts.unitsPerPack) || opts.unitsPerPack < 1) {
        throw new Error("Units per box must be a whole number ≥ 1");
      }
    }
    if (opts.innerProductId) {
      if (opts.productId && opts.innerProductId === opts.productId) {
        throw new Error("Box cannot reference itself as inner product");
      }
      const inner = await prisma.product.findFirst({
        where: {
          id: opts.innerProductId,
          tenantId: opts.tenantId,
          isActive: true,
          packType: { not: "BOX" },
        },
      });
      if (!inner) {
        throw new Error("Inner product must be an active sachet, bottle, or jar SKU");
      }
    }
    return;
  }
  if (opts.innerProductId) {
    throw new Error("Inner product link is only for box packaging");
  }
  if (opts.unitsPerPack != null && opts.unitsPerPack > 0) {
    throw new Error("Units per pack is only for box packaging");
  }
}

export async function syncProductBomLines(opts: {
  tenantId: string;
  productId: string;
  lines: BomLineInput[];
  tx?: TxClient;
}) {
  const seen = new Set<string>();
  for (const line of opts.lines) {
    if (!(line.qty > 0)) {
      throw new Error("BOM qty must be greater than zero");
    }
    if (seen.has(line.materialId)) {
      throw new Error("Duplicate material in BOM");
    }
    seen.add(line.materialId);
  }

  const materialIds = opts.lines.map((l) => l.materialId);
  if (materialIds.length > 0) {
    const count = await (opts.tx ?? prisma).material.count({
      where: {
        tenantId: opts.tenantId,
        id: { in: materialIds },
        isActive: true,
      },
    });
    if (count !== materialIds.length) {
      throw new Error("One or more BOM materials not found");
    }
  }

  const run = async (tx: TxClient) => {
    await tx.productBomLine.deleteMany({
      where: { productId: opts.productId, tenantId: opts.tenantId },
    });
    if (opts.lines.length === 0) return;
    await tx.productBomLine.createMany({
      data: opts.lines.map((line, idx) => ({
        tenantId: opts.tenantId,
        productId: opts.productId,
        materialId: line.materialId,
        qty: line.qty,
        sortOrder: idx,
      })),
    });
  };

  if (opts.tx) return run(opts.tx);
  return prisma.$transaction(run);
}

export async function loadProductBom(productId: string, tenantId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, tenantId },
    include: {
      bomLines: {
        include: lineInclude,
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
      innerProduct: {
        include: {
          unit: true,
          bomLines: {
            include: lineInclude,
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          },
        },
      },
    },
  });
  if (!product) return null;

  const directLines = product.bomLines.map((l) =>
    serializeBomLine({ ...l, source: "direct" }),
  );

  const mult = product.unitsPerPack ?? 1;
  const innerLines =
    product.innerProduct?.bomLines.map((l) =>
      serializeBomLine({
        ...l,
        id: `inner-${l.id}`,
        qty: Number(l.qty) * mult,
        source: "inner",
      }),
    ) ?? [];

  const merged = new Map<
    string,
    ReturnType<typeof serializeBomLine> & { sources: string[] }
  >();

  for (const line of [...innerLines, ...directLines]) {
    const prev = merged.get(line.materialId);
    if (prev) {
      prev.qty += line.qty;
      prev.sources.push(line.source);
    } else {
      merged.set(line.materialId, {
        ...line,
        sources: [line.source],
      });
    }
  }

  return {
    directLines,
    innerLines,
    effectiveLines: [...merged.values()],
    innerProduct: product.innerProduct
      ? {
          id: product.innerProduct.id,
          name: product.innerProduct.name,
          nameBn: product.innerProduct.nameBn,
          sku: product.innerProduct.sku,
          packType: product.innerProduct.packType,
          size:
            product.innerProduct.size == null
              ? null
              : Number(product.innerProduct.size),
          unit: product.innerProduct.unit
            ? {
                code: product.innerProduct.unit.code,
                nameEn: product.innerProduct.unit.nameEn,
                nameBn: product.innerProduct.unit.nameBn,
              }
            : null,
        }
      : null,
    unitsPerPack: product.unitsPerPack,
  };
}

export async function getProductBomLineCount(productId: string) {
  return prisma.productBomLine.count({ where: { productId } });
}
