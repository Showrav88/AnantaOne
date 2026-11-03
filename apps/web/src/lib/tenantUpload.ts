import { api } from "./api";
import {
  compressImageFile,
  uploadToCloudinaryDirect,
} from "./imageUpload";

type Purpose = "assets" | "logo" | "hero" | "products" | "staff";

/**
 * Compress (images) + upload directly to Cloudinary + register on API.
 * Avoids HTTP 413 from sending large files through Render.
 */
export async function uploadTenantMedia(opts: {
  file: File;
  purpose: Purpose;
  publicId?: string;
  label?: string;
  productId?: string;
  staffId?: string;
}) {
  const isVideo = opts.file.type.startsWith("video/");
  const prepared = isVideo
    ? opts.file
    : await compressImageFile(opts.file);

  const { sign } = await api.owner.signMedia({
    purpose: opts.purpose,
    publicId: opts.publicId,
  });

  const uploaded = await uploadToCloudinaryDirect(
    prepared,
    sign,
    isVideo ? "video" : "image",
  );

  const { asset } = await api.owner.registerMedia({
    purpose: opts.purpose,
    kind: uploaded.kind,
    url: uploaded.url,
    publicId: uploaded.publicId,
    folder: sign.folder,
    format: uploaded.format,
    bytes: uploaded.bytes,
    width: uploaded.width,
    height: uploaded.height,
    durationSec: uploaded.durationSec,
    originalName: opts.file.name,
    label: opts.label ?? null,
    productId: opts.productId,
    staffId: opts.staffId,
  });

  return { asset, uploaded };
}
