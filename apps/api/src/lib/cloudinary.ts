import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

let configured = false;

export function isCloudinaryConfigured() {
  return Boolean(process.env.CLOUDINARY_URL?.trim());
}

export function ensureCloudinary() {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      "CLOUDINARY_URL is not set. Add it on the API service (Render Environment).",
    );
  }
  if (!configured) {
    // SDK reads CLOUDINARY_URL=cloudinary://KEY:SECRET@CLOUD_NAME
    cloudinary.config(true);
    configured = true;
  }
  return cloudinary;
}

export function tenantFolder(slug: string, sub?: string) {
  const base = `anantaone/tenants/${slug}`;
  return sub ? `${base}/${sub}` : base;
}

export type UploadedMedia = {
  kind: "IMAGE" | "VIDEO";
  url: string;
  publicId: string;
  folder: string;
  format: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
};

export async function uploadBufferToCloudinary(opts: {
  buffer: Buffer;
  folder: string;
  resourceType: "image" | "video" | "auto";
  publicId?: string;
  originalName?: string;
}): Promise<UploadedMedia> {
  const cld = ensureCloudinary();

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cld.uploader.upload_stream(
      {
        folder: opts.folder,
        resource_type: opts.resourceType,
        public_id: opts.publicId,
        overwrite: Boolean(opts.publicId),
        unique_filename: !opts.publicId,
        use_filename: true,
      },
      (err, res) => {
        if (err || !res) {
          reject(err ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve(res);
      },
    );
    stream.end(opts.buffer);
  });

  const isVideo =
    result.resource_type === "video" ||
    opts.resourceType === "video" ||
    Boolean(result.duration);

  return {
    kind: isVideo ? "VIDEO" : "IMAGE",
    url: result.secure_url,
    publicId: result.public_id,
    folder: opts.folder,
    format: result.format ?? null,
    bytes: result.bytes ?? null,
    width: result.width ?? null,
    height: result.height ?? null,
    durationSec:
      typeof result.duration === "number" ? result.duration : null,
  };
}

export async function destroyCloudinaryAsset(
  publicId: string,
  kind: "IMAGE" | "VIDEO",
) {
  if (!isCloudinaryConfigured()) return;
  const cld = ensureCloudinary();
  await cld.uploader.destroy(publicId, {
    resource_type: kind === "VIDEO" ? "video" : "image",
  });
}
