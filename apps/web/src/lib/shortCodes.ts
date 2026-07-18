/** Keep in sync with apps/api/src/lib/shortCodes.ts */
const ALPH = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const UNIT_SERIAL_WIDTH = 6;

export function toBase36(n: number, width: number): string {
  let x = Math.floor(Number(n));
  if (!Number.isFinite(x) || x < 0) return "".padStart(width, "0");
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

/** Compact unit code used on tags / QR: {SKU}{base36×6} */
export function makeShortSerialCode(sku: string, serialNo: number): string {
  const s = normalizeSkuPart(sku, 4);
  return `${s}${toBase36(serialNo, UNIT_SERIAL_WIDTH)}`;
}
