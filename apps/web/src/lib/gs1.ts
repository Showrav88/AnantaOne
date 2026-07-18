/** Client-side GS1 helpers for tag preview (mirrors API lib). */

export function gtinCheckDigit(body: string): string {
  if (!/^\d+$/.test(body)) throw new Error("GTIN body must be numeric");
  let sum = 0;
  for (let i = 0; i < body.length; i += 1) {
    const digit = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  return String((10 - (sum % 10)) % 10);
}

export function toGtin14(gtin: string): string {
  const d = String(gtin).replace(/\D/g, "");
  if (d.length === 14) return d;
  if (d.length === 13) return `0${d}`;
  if (d.length === 12) return `00${d}`;
  throw new Error("Unsupported GTIN length");
}

export function validateGtin(gtin: string): boolean {
  const d = String(gtin).replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(d.length)) return false;
  try {
    return gtinCheckDigit(d.slice(0, -1)) === d.slice(-1);
  } catch {
    return false;
  }
}

export function buildGs1ElementString(
  gtin: string,
  lot: string,
  serial: string,
): string {
  const g14 = toGtin14(gtin);
  const lotAi = String(lot || "0")
    .replace(/[()]/g, "")
    .replace(/\s+/g, "")
    .slice(0, 20);
  const serAi = String(serial)
    .replace(/[()]/g, "")
    .replace(/\s+/g, "")
    .slice(0, 20);
  return `(01)${g14}(10)${lotAi}(21)${serAi}`;
}

export function buildGs1DigitalLink(opts: {
  origin: string;
  gtin: string;
  serial: string;
  lot?: string | null;
}): string {
  const g14 = toGtin14(opts.gtin);
  const base = opts.origin.replace(/\/$/, "");
  const path = `${base}${window.location.pathname}#/dl/01/${g14}/21/${encodeURIComponent(opts.serial)}`;
  if (opts.lot) {
    return `${path}?10=${encodeURIComponent(opts.lot)}`;
  }
  return path;
}
