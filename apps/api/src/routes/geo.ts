import { Router } from "express";
import { prisma } from "../db.js";
import { ensureBdGeoSeeded, serializeGeoPlace } from "../lib/bdGeo.js";

export const geoRouter = Router();

geoRouter.use(async (_req, _res, next) => {
  try {
    await ensureBdGeoSeeded();
    next();
  } catch (err) {
    next(err);
  }
});

geoRouter.get("/divisions", async (_req, res) => {
  const rows = await prisma.bdDivision.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  res.json({ ok: true, divisions: rows.map(serializeGeoPlace) });
});

geoRouter.get("/districts", async (req, res) => {
  const divisionId = req.query.divisionId
    ? String(req.query.divisionId)
    : undefined;
  const rows = await prisma.bdDistrict.findMany({
    where: divisionId ? { divisionId } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  res.json({
    ok: true,
    districts: rows.map((r) => ({
      ...serializeGeoPlace(r),
      divisionId: r.divisionId,
    })),
  });
});

geoRouter.get("/upazilas", async (req, res) => {
  const districtId = req.query.districtId
    ? String(req.query.districtId)
    : undefined;
  if (!districtId) {
    res.status(400).json({ ok: false, message: "districtId required" });
    return;
  }
  const rows = await prisma.bdUpazila.findMany({
    where: { districtId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  res.json({
    ok: true,
    upazilas: rows.map((r) => ({
      ...serializeGeoPlace(r),
      districtId: r.districtId,
    })),
  });
});
