import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

type CloudinaryCreds = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  source: "CLOUDINARY_URL" | "discrete";
};

let cached: CloudinaryCreds | null = null;

function stripQuotes(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, "").trim();
}

/** Parse cloudinary://API_KEY:API_SECRET@CLOUD_NAME (secret may be URL-encoded). */
export function parseCloudinaryUrl(raw: string): Omit<CloudinaryCreds, "source"> {
  const cleaned = stripQuotes(raw);
  const match = cleaned.match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/\s]+)/i);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw new Error(
      'Invalid CLOUDINARY_URL. Expected: cloudinary://<api_key>:<api_secret>@dtd4hpmjb (no spaces/quotes)',
    );
  }
  return {
    apiKey: decodeURIComponent(match[1]),
    apiSecret: decodeURIComponent(match[2]),
    cloudName: decodeURIComponent(match[3]).replace(/\/+$/, ""),
  };
}

export function resolveCloudinaryCreds(): CloudinaryCreds | null {
  const url = process.env.CLOUDINARY_URL
    ? stripQuotes(process.env.CLOUDINARY_URL)
    : "";
  if (url) {
    const parsed = parseCloudinaryUrl(url);
    return { ...parsed, source: "CLOUDINARY_URL" };
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    ? stripQuotes(process.env.CLOUDINARY_CLOUD_NAME)
    : "";
  const apiKey = process.env.CLOUDINARY_API_KEY
    ? stripQuotes(process.env.CLOUDINARY_API_KEY)
    : "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET
    ? stripQuotes(process.env.CLOUDINARY_API_SECRET)
    : "";

  if (cloudName && apiKey && apiSecret) {
    return { cloudName, apiKey, apiSecret, source: "discrete" };
  }
  return null;
}

export function isCloudinaryConfigured() {
  try {
    return Boolean(resolveCloudinaryCreds());
  } catch {
    return false;
  }
}

export function ensureCloudinary() {
  const creds = resolveCloudinaryCreds();
  if (!creds) {
    throw new Error(
      "Cloudinary is not set. On the API service add CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@dtd4hpmjb (or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET).",
    );
  }

  // Always re-apply config so env fixes take effect without restart races
  cloudinary.config({
    cloud_name: creds.cloudName,
    api_key: String(creds.apiKey),
    api_secret: String(creds.apiSecret),
    secure: true,
  });
  cached = creds;
  return cloudinary;
}

export function cloudinaryPublicConfig() {
  ensureCloudinary();
  const creds = cached ?? resolveCloudinaryCreds();
  if (!creds) {
    throw new Error("Cloudinary config incomplete");
  }
  return {
    cloudName: creds.cloudName,
    apiKey: String(creds.apiKey),
    apiSecret: String(creds.apiSecret),
    source: creds.source,
  };
}

export function tenantFolder(slug: string, sub?: string) {
  const base = `anantaone/tenants/${slug}`;
  return sub ? `${base}/${sub}` : base;
}

/** Signed params so the browser can upload directly to Cloudinary (avoids Render 413). */
export function signCloudinaryUpload(opts: {
  folder: string;
  publicId?: string;
}) {
  const { cloudName, apiKey, apiSecret } = cloudinaryPublicConfig();
  const timestamp = Math.round(Date.now() / 1000);
  // Only sign params we will send (except file / api_key / cloud_name / resource_type)
  const paramsToSign: Record<string, string | number> = {
    timestamp,
    folder: opts.folder,
  };
  if (opts.publicId) {
    paramsToSign.public_id = opts.publicId;
    paramsToSign.overwrite = "true";
  }
  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);
  return {
    cloudName,
    apiKey: String(apiKey),
    timestamp,
    signature,
    folder: opts.folder,
    publicId: opts.publicId,
  };
}

export async function pingCloudinary() {
  const cld = ensureCloudinary();
  const creds = cloudinaryPublicConfig();
  await cld.api.ping();
  return {
    ok: true as const,
    cloudName: creds.cloudName,
    apiKeyHint: `${creds.apiKey.slice(0, 4)}…${creds.apiKey.slice(-4)}`,
    source: creds.source,
  };
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
