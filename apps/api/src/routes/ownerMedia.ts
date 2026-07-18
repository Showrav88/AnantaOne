import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import {
  requireCompanyStaff,
  requireOwnerOrManager,
} from "../middleware/companyAccess.js";
import {
  destroyCloudinaryAsset,
  isCloudinaryConfigured,
  pingCloudinary,
  signCloudinaryUpload,
  tenantFolder,
  uploadBufferToCloudinary,
} from "../lib/cloudinary.js";

export const ownerMediaRouter = Router();

ownerMediaRouter.use(requireAuth, requireCompanyStaff);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok =
      file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/");
    if (!ok) {
      cb(new Error("Only image or video uploads are allowed"));
      return;
    }
    cb(null, true);
  },
});

function tid(req: { auth?: { tenantId: string | null } }) {
  return req.auth!.tenantId!;
}

function serializeAsset(asset: {
  id: string;
  tenantId: string;
  kind: string;
  url: string;
  publicId: string;
  folder: string;
  format: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  originalName: string | null;
  label: string | null;
  createdAt: Date;
}) {
  return {
    id: asset.id,
    tenantId: asset.tenantId,
    kind: asset.kind,
    url: asset.url,
    publicId: asset.publicId,
    folder: asset.folder,
    format: asset.format,
    bytes: asset.bytes,
    width: asset.width,
    height: asset.height,
    durationSec: asset.durationSec,
    originalName: asset.originalName,
    label: asset.label,
    createdAt: asset.createdAt,
  };
}

function serializeBranding(company: {
  id: string;
  name: string;
  slug: string;
  locale: string;
  phone: string | null;
  address: string | null;
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  logoPublicId: string | null;
  heroImageUrl: string | null;
  heroImagePublicId: string | null;
  heroVideoUrl: string | null;
  heroVideoPublicId: string | null;
  brandPrimary: string | null;
  brandAccent: string | null;
  brandBg: string | null;
  brandFont: string | null;
  siteHeadline: string | null;
  siteSubhead: string | null;
}) {
  return {
    id: company.id,
    name: company.name,
    slug: company.slug,
    locale: company.locale,
    phone: company.phone,
    address: company.address,
    tagline: company.tagline,
    description: company.description,
    logoUrl: company.logoUrl,
    logoPublicId: company.logoPublicId,
    heroImageUrl: company.heroImageUrl,
    heroImagePublicId: company.heroImagePublicId,
    heroVideoUrl: company.heroVideoUrl,
    heroVideoPublicId: company.heroVideoPublicId,
    brandPrimary: company.brandPrimary ?? "#0f6b4c",
    brandAccent: company.brandAccent ?? "#f42a41",
    brandBg: company.brandBg ?? "#06281f",
    brandFont: company.brandFont ?? "source-sans",
    siteHeadline: company.siteHeadline,
    siteSubhead: company.siteSubhead,
    cloudinaryReady: isCloudinaryConfigured(),
    publicShopPath: `/#/shop/${company.slug}`,
  };
}

ownerMediaRouter.get("/branding", async (req, res) => {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: tid(req) },
  });
  res.json({ ok: true, branding: serializeBranding(company) });
});

const brandingSchema = z.object({
  brandPrimary: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    .optional(),
  brandAccent: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    .optional(),
  brandBg: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    .optional(),
  brandFont: z
    .enum(["source-sans", "noto-bengali", "dm-sans", "libre-baskerville"])
    .optional(),
  siteHeadline: z.string().max(160).nullable().optional(),
  siteSubhead: z.string().max(320).nullable().optional(),
  logoAssetId: z.string().cuid().nullable().optional(),
  heroImageAssetId: z.string().cuid().nullable().optional(),
  heroVideoAssetId: z.string().cuid().nullable().optional(),
  clearLogo: z.boolean().optional(),
  clearHeroImage: z.boolean().optional(),
  clearHeroVideo: z.boolean().optional(),
});

ownerMediaRouter.patch("/branding", requireOwnerOrManager, async (req, res) => {
  const parsed = brandingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: parsed.error.message });
    return;
  }

  const tenantId = tid(req);
  const data: Record<string, string | null> = {};
  const body = parsed.data;

  if (body.brandPrimary !== undefined) data.brandPrimary = body.brandPrimary;
  if (body.brandAccent !== undefined) data.brandAccent = body.brandAccent;
  if (body.brandBg !== undefined) data.brandBg = body.brandBg;
  if (body.brandFont !== undefined) data.brandFont = body.brandFont;
  if (body.siteHeadline !== undefined) data.siteHeadline = body.siteHeadline;
  if (body.siteSubhead !== undefined) data.siteSubhead = body.siteSubhead;

  async function resolveAsset(id: string | null | undefined, kind?: "IMAGE" | "VIDEO") {
    if (!id) return null;
    const asset = await prisma.mediaAsset.findFirst({
      where: { id, tenantId, ...(kind ? { kind } : {}) },
    });
    if (!asset) throw new Error("Media asset not found for this company");
    return asset;
  }

  try {
    if (body.clearLogo) {
      data.logoUrl = null;
      data.logoPublicId = null;
    } else if (body.logoAssetId) {
      const asset = await resolveAsset(body.logoAssetId, "IMAGE");
      if (asset) {
        data.logoUrl = asset.url;
        data.logoPublicId = asset.publicId;
      }
    }

    if (body.clearHeroImage) {
      data.heroImageUrl = null;
      data.heroImagePublicId = null;
    } else if (body.heroImageAssetId) {
      const asset = await resolveAsset(body.heroImageAssetId, "IMAGE");
      if (asset) {
        data.heroImageUrl = asset.url;
        data.heroImagePublicId = asset.publicId;
      }
    }

    if (body.clearHeroVideo) {
      data.heroVideoUrl = null;
      data.heroVideoPublicId = null;
    } else if (body.heroVideoAssetId) {
      const asset = await resolveAsset(body.heroVideoAssetId, "VIDEO");
      if (asset) {
        data.heroVideoUrl = asset.url;
        data.heroVideoPublicId = asset.publicId;
      }
    }
  } catch (err) {
    res.status(400).json({
      ok: false,
      message: err instanceof Error ? err.message : "Invalid asset",
    });
    return;
  }

  const company = await prisma.company.update({
    where: { id: tenantId },
    data,
  });

  res.json({ ok: true, branding: serializeBranding(company) });
});

ownerMediaRouter.get("/media", async (req, res) => {
  const assets = await prisma.mediaAsset.findMany({
    where: { tenantId: tid(req) },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    ok: true,
    cloudinaryReady: isCloudinaryConfigured(),
    assets: assets.map(serializeAsset),
  });
});

function purposeSubfolder(purpose: string) {
  if (purpose === "logo") return "logo";
  if (purpose === "hero") return "hero";
  if (purpose === "products") return "products";
  return "assets";
}

const signSchema = z.object({
  purpose: z.enum(["assets", "logo", "hero", "products"]).default("assets"),
  publicId: z.string().max(120).optional(),
});

/** Diagnose Cloudinary credentials (no secret returned). */
ownerMediaRouter.get("/media/status", async (_req, res) => {
  if (!isCloudinaryConfigured()) {
    res.json({
      ok: true,
      cloudinaryReady: false,
      message:
        "Missing Cloudinary env on API. Set CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@dtd4hpmjb (Web Service env, then redeploy).",
    });
    return;
  }
  try {
    const ping = await pingCloudinary();
    res.json({
      ok: true,
      cloudinaryReady: true,
      cloudName: ping.cloudName,
      apiKeyHint: ping.apiKeyHint,
      source: ping.source,
      message: "Cloudinary credentials accepted.",
    });
  } catch (err) {
    res.status(502).json({
      ok: false,
      cloudinaryReady: false,
      message:
        err instanceof Error
          ? `Cloudinary rejected credentials: ${err.message}. Check API key/secret on the API Web Service (not Static Site), no quotes around the value, then redeploy.`
          : "Cloudinary ping failed",
    });
  }
});

/** Browser uploads directly to Cloudinary — avoids Render HTTP 413 on large files. */
ownerMediaRouter.post("/media/sign", requireOwnerOrManager, async (req, res) => {
  if (!isCloudinaryConfigured()) {
    res.status(503).json({
      ok: false,
      message:
        "Cloudinary is not configured. Set CLOUDINARY_URL on the API Web Service (Render), not the Static Site.",
    });
    return;
  }

  const parsed = signSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: parsed.error.message });
    return;
  }

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: tid(req) },
    select: { slug: true },
  });

  try {
    // Verify creds before signing so owners see a clear error
    await pingCloudinary();
    const sign = signCloudinaryUpload({
      folder: tenantFolder(company.slug, purposeSubfolder(parsed.data.purpose)),
      publicId: parsed.data.publicId,
    });
    res.json({
      ok: true,
      sign: {
        ...sign,
        apiKey: String(sign.apiKey),
      },
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      message: err instanceof Error ? err.message : "Sign failed",
    });
  }
});

const registerSchema = z.object({
  purpose: z.enum(["assets", "logo", "hero", "products"]).default("assets"),
  kind: z.enum(["IMAGE", "VIDEO"]),
  url: z.string().url(),
  publicId: z.string().min(1).max(240),
  folder: z.string().min(1).max(240),
  format: z.string().max(32).nullable().optional(),
  bytes: z.number().int().nonnegative().nullable().optional(),
  width: z.number().int().nonnegative().nullable().optional(),
  height: z.number().int().nonnegative().nullable().optional(),
  durationSec: z.number().nonnegative().nullable().optional(),
  originalName: z.string().max(240).nullable().optional(),
  label: z.string().max(160).nullable().optional(),
  productId: z.string().cuid().optional(),
});

/** Save a Cloudinary asset that was uploaded directly from the browser. */
ownerMediaRouter.post(
  "/media/register",
  requireOwnerOrManager,
  async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: parsed.error.message });
      return;
    }

    const data = parsed.data;
    const tenantId = tid(req);

    const asset = await prisma.mediaAsset.upsert({
      where: {
        tenantId_publicId: { tenantId, publicId: data.publicId },
      },
      create: {
        tenantId,
        kind: data.kind,
        url: data.url,
        publicId: data.publicId,
        folder: data.folder,
        format: data.format ?? null,
        bytes: data.bytes ?? null,
        width: data.width ?? null,
        height: data.height ?? null,
        durationSec: data.durationSec ?? null,
        originalName: data.originalName ?? null,
        label: data.label ?? null,
      },
      update: {
        url: data.url,
        format: data.format ?? null,
        bytes: data.bytes ?? null,
        width: data.width ?? null,
        height: data.height ?? null,
        durationSec: data.durationSec ?? null,
        originalName: data.originalName ?? null,
        label: data.label ?? null,
      },
    });

    if (data.purpose === "logo" && data.kind === "IMAGE") {
      await prisma.company.update({
        where: { id: tenantId },
        data: { logoUrl: data.url, logoPublicId: data.publicId },
      });
    } else if (data.purpose === "hero" && data.kind === "IMAGE") {
      await prisma.company.update({
        where: { id: tenantId },
        data: { heroImageUrl: data.url, heroImagePublicId: data.publicId },
      });
    } else if (data.purpose === "hero" && data.kind === "VIDEO") {
      await prisma.company.update({
        where: { id: tenantId },
        data: { heroVideoUrl: data.url, heroVideoPublicId: data.publicId },
      });
    }

    if (data.productId && data.kind === "IMAGE") {
      const product = await prisma.product.findFirst({
        where: { id: data.productId, tenantId },
      });
      if (product) {
        await prisma.product.update({
          where: { id: product.id },
          data: {
            imageUrl: data.url,
            imagePublicId: data.publicId,
            updatedBy: req.auth!.id,
          },
        });
      }
    }

    res.status(201).json({ ok: true, asset: serializeAsset(asset) });
  },
);

ownerMediaRouter.post(
  "/media",
  requireOwnerOrManager,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        const isTooLarge =
          err instanceof Error &&
          ("code" in err
            ? (err as { code?: string }).code === "LIMIT_FILE_SIZE"
            : /large|size/i.test(err.message));
        res.status(isTooLarge ? 413 : 400).json({
          ok: false,
          message: isTooLarge
            ? "File too large for the API proxy. Use a smaller image (under ~1MB) or retry — the app compresses photos automatically."
            : err instanceof Error
              ? err.message
              : "Upload failed",
        });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    if (!isCloudinaryConfigured()) {
      res.status(503).json({
        ok: false,
        message:
          "Cloudinary is not configured. Set CLOUDINARY_URL on the API service.",
      });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ ok: false, message: "file is required" });
      return;
    }

    const company = await prisma.company.findUniqueOrThrow({
      where: { id: tid(req) },
      select: { slug: true },
    });

    const purpose = String(req.body.purpose ?? "assets");
    const sub =
      purpose === "logo"
        ? "logo"
        : purpose === "hero"
          ? "hero"
          : purpose === "products"
            ? "products"
            : "assets";

    const resourceType = file.mimetype.startsWith("video/")
      ? "video"
      : file.mimetype.startsWith("image/")
        ? "image"
        : "auto";

    try {
      const uploaded = await uploadBufferToCloudinary({
        buffer: file.buffer,
        folder: tenantFolder(company.slug, sub),
        resourceType,
        originalName: file.originalname,
      });

      const asset = await prisma.mediaAsset.create({
        data: {
          tenantId: tid(req),
          kind: uploaded.kind,
          url: uploaded.url,
          publicId: uploaded.publicId,
          folder: uploaded.folder,
          format: uploaded.format,
          bytes: uploaded.bytes,
          width: uploaded.width,
          height: uploaded.height,
          durationSec: uploaded.durationSec,
          originalName: file.originalname,
          label: typeof req.body.label === "string" ? req.body.label : null,
        },
      });

      // Convenience: assign to branding slots when purpose matches
      if (purpose === "logo" && uploaded.kind === "IMAGE") {
        await prisma.company.update({
          where: { id: tid(req) },
          data: { logoUrl: uploaded.url, logoPublicId: uploaded.publicId },
        });
      } else if (purpose === "hero" && uploaded.kind === "IMAGE") {
        await prisma.company.update({
          where: { id: tid(req) },
          data: {
            heroImageUrl: uploaded.url,
            heroImagePublicId: uploaded.publicId,
          },
        });
      } else if (purpose === "hero" && uploaded.kind === "VIDEO") {
        await prisma.company.update({
          where: { id: tid(req) },
          data: {
            heroVideoUrl: uploaded.url,
            heroVideoPublicId: uploaded.publicId,
          },
        });
      }

      res.status(201).json({
        ok: true,
        asset: serializeAsset(asset),
        cloudinaryReady: true,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        message: err instanceof Error ? err.message : "Upload failed",
      });
    }
  },
);

ownerMediaRouter.delete("/media/:id", requireOwnerOrManager, async (req, res) => {
  const id = String(req.params.id);
  const asset = await prisma.mediaAsset.findFirst({
    where: { id, tenantId: tid(req) },
  });
  if (!asset) {
    res.status(404).json({ ok: false, message: "Asset not found" });
    return;
  }

  try {
    await destroyCloudinaryAsset(
      asset.publicId,
      asset.kind === "VIDEO" ? "VIDEO" : "IMAGE",
    );
  } catch {
    // Continue deleting DB row even if remote destroy fails
  }

  const company = await prisma.company.findUnique({ where: { id: tid(req) } });
  if (company) {
    const clear: Record<string, null> = {};
    if (company.logoPublicId === asset.publicId) {
      clear.logoUrl = null;
      clear.logoPublicId = null;
    }
    if (company.heroImagePublicId === asset.publicId) {
      clear.heroImageUrl = null;
      clear.heroImagePublicId = null;
    }
    if (company.heroVideoPublicId === asset.publicId) {
      clear.heroVideoUrl = null;
      clear.heroVideoPublicId = null;
    }
    if (Object.keys(clear).length) {
      await prisma.company.update({ where: { id: company.id }, data: clear });
    }
  }

  await prisma.product.updateMany({
    where: { tenantId: tid(req), imagePublicId: asset.publicId },
    data: { imageUrl: null, imagePublicId: null },
  });

  await prisma.mediaAsset.delete({ where: { id: asset.id } });
  res.json({ ok: true });
});

ownerMediaRouter.post(
  "/products/:id/image",
  requireOwnerOrManager,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        res.status(400).json({
          ok: false,
          message: err instanceof Error ? err.message : "Upload failed",
        });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    if (!isCloudinaryConfigured()) {
      res.status(503).json({
        ok: false,
        message:
          "Cloudinary is not configured. Set CLOUDINARY_URL on the API service.",
      });
      return;
    }

    const file = req.file;
    if (!file || !file.mimetype.startsWith("image/")) {
      res.status(400).json({ ok: false, message: "Image file is required" });
      return;
    }

    const productId = String(req.params.id);
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: tid(req) },
    });
    if (!product) {
      res.status(404).json({ ok: false, message: "Product not found" });
      return;
    }

    const company = await prisma.company.findUniqueOrThrow({
      where: { id: tid(req) },
      select: { slug: true },
    });

    try {
      const uploaded = await uploadBufferToCloudinary({
        buffer: file.buffer,
        folder: tenantFolder(company.slug, "products"),
        resourceType: "image",
        publicId: `${product.sku}`.replace(/[^a-zA-Z0-9_-]/g, "_"),
        originalName: file.originalname,
      });

      await prisma.mediaAsset.upsert({
        where: {
          tenantId_publicId: {
            tenantId: tid(req),
            publicId: uploaded.publicId,
          },
        },
        create: {
          tenantId: tid(req),
          kind: "IMAGE",
          url: uploaded.url,
          publicId: uploaded.publicId,
          folder: uploaded.folder,
          format: uploaded.format,
          bytes: uploaded.bytes,
          width: uploaded.width,
          height: uploaded.height,
          originalName: file.originalname,
          label: product.name,
        },
        update: {
          url: uploaded.url,
          format: uploaded.format,
          bytes: uploaded.bytes,
          width: uploaded.width,
          height: uploaded.height,
          originalName: file.originalname,
        },
      });

      const updated = await prisma.product.update({
        where: { id: product.id },
        data: {
          imageUrl: uploaded.url,
          imagePublicId: uploaded.publicId,
          updatedBy: req.auth!.id,
        },
        include: { unit: true },
      });

      res.json({
        ok: true,
        product: {
          id: updated.id,
          imageUrl: updated.imageUrl,
          imagePublicId: updated.imagePublicId,
          name: updated.name,
          sku: updated.sku,
        },
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        message: err instanceof Error ? err.message : "Upload failed",
      });
    }
  },
);
