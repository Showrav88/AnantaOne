/** Compress images in-browser so uploads stay under proxy limits (avoids HTTP 413). */
export async function compressImageFile(
  file: File,
  opts?: { maxEdge?: number; quality?: number; maxBytes?: number },
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const maxEdge = opts?.maxEdge ?? 1600;
  const quality = opts?.quality ?? 0.82;
  const maxBytes = opts?.maxBytes ?? 900_000;

  if (file.size <= maxBytes && file.type === "image/jpeg") {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let q = quality;
  let blob: Blob | null = await canvasToBlob(canvas, "image/jpeg", q);
  while (blob && blob.size > maxBytes && q > 0.45) {
    q -= 0.1;
    blob = await canvasToBlob(canvas, "image/jpeg", q);
  }

  if (!blob) return file;

  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}

export type CloudinarySign = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId?: string;
};

/** Upload image/video straight to Cloudinary (bypasses Render body size / 413). */
export async function uploadToCloudinaryDirect(
  file: File,
  sign: CloudinarySign,
  resourceType: "image" | "video" = "image",
): Promise<{
  url: string;
  publicId: string;
  format: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  kind: "IMAGE" | "VIDEO";
}> {
  const form = new FormData();
  form.append("file", file);
  // api_key must be a string — numeric JSON can drop precision / confuse Cloudinary
  form.append("api_key", String(sign.apiKey));
  form.append("timestamp", String(sign.timestamp));
  form.append("signature", String(sign.signature));
  form.append("folder", String(sign.folder));
  if (sign.publicId) {
    form.append("public_id", String(sign.publicId));
    form.append("overwrite", "true");
  }

  const cloud = String(sign.cloudName).trim();
  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/${resourceType}/upload`;
  const res = await fetch(endpoint, { method: "POST", body: form });
  const data = (await res.json().catch(() => null)) as {
    error?: { message?: string };
    secure_url?: string;
    public_id?: string;
    format?: string;
    bytes?: number;
    width?: number;
    height?: number;
    duration?: number;
    resource_type?: string;
  } | null;

  if (!res.ok || !data?.secure_url || !data.public_id) {
    const raw = data?.error?.message ?? `Cloudinary upload failed (HTTP ${res.status})`;
    if (/invalid api key/i.test(raw)) {
      throw new Error(
        `${raw}. Cloud "${cloud}" + key must match the same Cloudinary account. On Render API env set CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@${cloud} with no quotes, then redeploy the API.`,
      );
    }
    throw new Error(raw);
  }

  const kind: "IMAGE" | "VIDEO" =
    resourceType === "video" || data.resource_type === "video"
      ? "VIDEO"
      : "IMAGE";

  return {
    url: data.secure_url,
    publicId: data.public_id,
    format: data.format ?? null,
    bytes: data.bytes ?? null,
    width: data.width ?? null,
    height: data.height ?? null,
    durationSec: typeof data.duration === "number" ? data.duration : null,
    kind,
  };
}
