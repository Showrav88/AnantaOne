/** Crockford-ish base36 (0-9A-Z) for short product / unit codes. */
const ALPH = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** 36^6 = 2_176_782_336 — enough for ≥ 1 billion unit sequences. */
export const UNIT_SERIAL_WIDTH = 6;

/** 36^3 = 46_656 products per category prefix. */
export const PRODUCT_SKU_WIDTH = 3;

/** 36^2 = 1_296 batches per product. */
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

export function normalizeSkuPart(sku: string, max = 4): string {
  return sku.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, max);
}

export function categorySkuPrefix(category: string): string {
  switch (category.toUpperCase()) {
    case "DRINKING":
      return "D";
    case "DISTILLED":
      return "T";
    case "BATTERY":
      return "B";
    default:
      return "X";
  }
}

/**
 * Compact unit QR code: {SKU}{base36 serial width 6}
 * Example: D001000001 → product D001, unit #1
 * Max serial with width 6: ~2.17B (≥ 1 billion).
 */
export function makeShortSerialCode(sku: string, serialNo: number): string {
  const s = normalizeSkuPart(sku, 4);
  return `${s}${toBase36(serialNo, UNIT_SERIAL_WIDTH)}`;
}

/** Short batch code: {SKU}B{base36 seq} e.g. D001B01 */
export function makeShortBatchCode(sku: string, batchSeq: number): string {
  const s = normalizeSkuPart(sku, 4);
  return `${s}B${toBase36(batchSeq, BATCH_SEQ_WIDTH)}`;
}

export function buildAutoSku(category: string, seq: number): string {
  return `${categorySkuPrefix(category)}${toBase36(seq, PRODUCT_SKU_WIDTH)}`;
}
