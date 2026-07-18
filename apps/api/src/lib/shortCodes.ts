/** Crockford-ish base36 (0-9A-Z) for short product / unit codes. */
const ALPH = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** 36^6 = 2_176_782_336 — enough for ≥ 1 billion unit sequences. */
export const UNIT_SERIAL_WIDTH = 6;

/** 36^3 = 46_656 products per category prefix. */
export const PRODUCT_SKU_WIDTH = 3;

/** 36^2 = 1_296 company-wide short batches (B01…BZZ); grows past width if needed. */
export const BATCH_SEQ_WIDTH = 2;

export function toBase36(n: number, width: number): string {
  let x = Math.floor(Number(n));
  if (!Number.isFinite(x) || x < 0) {
    throw new Error("Invalid sequence number");
  }
  if (x === 0) return "0".padStart(width, "0");
  let s = "";
  while (x > 0) {
    s = ALPH[x % 36]! + s;
    x = Math.floor(x / 36);
  }
  if (s.length < width) return s.padStart(width, "0");
  return s;
}

/** Keep full auto SKU (e.g. MW001 = 5 chars). */
export function normalizeSkuPart(sku: string, max = 5): string {
  return sku.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, max);
}

/**
 * Two-letter prefix from product type words:
 * Distilled Water → DW, Mineral Water → MW, Battery Water → BW
 * (Category code DRINKING = Mineral Water in the UI.)
 */
export function categorySkuPrefix(category: string): string {
  switch (category.toUpperCase()) {
    case "DRINKING":
    case "MINERAL":
      return "MW";
    case "DISTILLED":
      return "DW";
    case "BATTERY":
      return "BW";
    default:
      return "XX";
  }
}

/**
 * Compact unit QR code: {SKU}{base36 serial width 6}
 * Example: MW001000001 → product MW001, unit #1
 * Max serial with width 6: ~2.17B (≥ 1 billion).
 */
export function makeShortSerialCode(sku: string, serialNo: number): string {
  const s = normalizeSkuPart(sku, 5);
  return `${s}${toBase36(serialNo, UNIT_SERIAL_WIDTH)}`;
}

/**
 * Short batch code (company-wide): B01, B02, … BZZ
 * Product SKU stays on the product/tag — not repeated in the batch code.
 */
export function makeShortBatchCode(batchSeq: number): string {
  return `B${toBase36(batchSeq, BATCH_SEQ_WIDTH)}`;
}

export function buildAutoSku(category: string, seq: number): string {
  return `${categorySkuPrefix(category)}${toBase36(seq, PRODUCT_SKU_WIDTH)}`;
}
