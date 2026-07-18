import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../db.js";

type GeoFile = {
  divisions: Array<{ code: string; name: string; nameBn: string }>;
  districts: Array<{
    code: string;
    divisionCode: string;
    name: string;
    nameBn: string;
    upazilas: Array<{ code: string; name: string; nameBn: string }>;
  }>;
};

function loadGeoFile(): GeoFile {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "../data/bd-geo.json");
  return JSON.parse(readFileSync(path, "utf8")) as GeoFile;
}

/** Idempotent seed of BD division → district → upazila reference data. */
export async function ensureBdGeoSeeded() {
  const existing = await prisma.bdDivision.count();
  if (existing >= 8) {
    const upazilaCount = await prisma.bdUpazila.count();
    if (upazilaCount > 400) return;
  }

  const geo = loadGeoFile();
  let divOrder = 0;
  for (const div of geo.divisions) {
    divOrder += 1;
    const division = await prisma.bdDivision.upsert({
      where: { code: div.code },
      create: {
        code: div.code,
        name: div.name,
        nameBn: div.nameBn,
        sortOrder: divOrder,
      },
      update: {
        name: div.name,
        nameBn: div.nameBn,
        sortOrder: divOrder,
      },
    });

    let distOrder = 0;
    for (const dist of geo.districts.filter(
      (d) => d.divisionCode === div.code,
    )) {
      distOrder += 1;
      const district = await prisma.bdDistrict.upsert({
        where: { code: dist.code },
        create: {
          code: dist.code,
          divisionId: division.id,
          name: dist.name,
          nameBn: dist.nameBn,
          sortOrder: distOrder,
        },
        update: {
          divisionId: division.id,
          name: dist.name,
          nameBn: dist.nameBn,
          sortOrder: distOrder,
        },
      });

      let upaOrder = 0;
      for (const upa of dist.upazilas) {
        upaOrder += 1;
        await prisma.bdUpazila.upsert({
          where: { code: upa.code },
          create: {
            code: upa.code,
            districtId: district.id,
            name: upa.name,
            nameBn: upa.nameBn,
            sortOrder: upaOrder,
          },
          update: {
            districtId: district.id,
            name: upa.name,
            nameBn: upa.nameBn,
            sortOrder: upaOrder,
          },
        });
      }
    }
  }
}

export async function getOrCreateDeliverySettings(tenantId: string) {
  return prisma.deliverySettings.upsert({
    where: { tenantId },
    create: { tenantId },
    update: {},
  });
}

/** Create Ward 1..N for the company's selected upazila (idempotent by name). */
export async function seedWardsForCompanyLocation(opts: {
  tenantId: string;
  branchId?: string | null;
  districtId: string;
  upazilaId: string;
  wardCount?: number;
  freeWardCount?: number;
  replaceExisting?: boolean;
}) {
  const settings = await getOrCreateDeliverySettings(opts.tenantId);
  const wardCount = Math.min(
    50,
    Math.max(1, opts.wardCount ?? settings.defaultWardCount),
  );
  const freeWardCount = Math.min(
    wardCount,
    Math.max(0, opts.freeWardCount ?? settings.freeWardCount),
  );
  const branchId = opts.branchId ?? null;

  if (opts.replaceExisting) {
    await prisma.deliveryWard.deleteMany({
      where: {
        tenantId: opts.tenantId,
        upazilaId: opts.upazilaId,
        branchId,
      },
    });
  }

  const created = [];
  for (let i = 1; i <= wardCount; i += 1) {
    const name = `Ward ${i}`;
    const existing = await prisma.deliveryWard.findFirst({
      where: {
        tenantId: opts.tenantId,
        name,
        upazilaId: opts.upazilaId,
        branchId,
      },
    });
    if (existing) {
      created.push(existing);
      continue;
    }
    const ward = await prisma.deliveryWard.create({
      data: {
        tenantId: opts.tenantId,
        branchId,
        districtId: opts.districtId,
        upazilaId: opts.upazilaId,
        name,
        nameBn: `ওয়ার্ড ${i}`,
        sortOrder: i,
        freeDelivery: i <= freeWardCount,
        baseChargeBdt: i <= freeWardCount ? 0 : 20 + i * 5,
      },
    });
    created.push(ward);
  }

  const rateDefaults = [
    { category: "DRINKING", chargePerUnitBdt: 5, note: "Per bottle/jar by weight" },
    { category: "DISTILLED", chargePerUnitBdt: 8, note: "Distilled water delivery" },
    { category: "BATTERY", chargePerUnitBdt: 10, note: "Battery water delivery" },
    { category: "OTHER", chargePerUnitBdt: 6, note: "Fallback" },
  ] as const;
  for (const d of rateDefaults) {
    await prisma.deliveryCategoryRate.upsert({
      where: {
        tenantId_category: { tenantId: opts.tenantId, category: d.category },
      },
      create: { tenantId: opts.tenantId, ...d },
      update: {},
    });
  }

  return created;
}

export function serializeGeoPlace(p: {
  id: string;
  code: string;
  name: string;
  nameBn: string | null;
}) {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    nameBn: p.nameBn,
  };
}
