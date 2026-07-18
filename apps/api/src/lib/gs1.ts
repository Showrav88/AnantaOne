import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";

type TxClient = Prisma.TransactionClient;

/** GS1 mod-10 check digit for a numeric body (without check digit). */
export function gtinCheckDigit(body: string): string {
  if (!/^\d+$/.test(body)) {
    throw new Error("GTIN body must be numeric");
  }
  let sum = 0;
  // From the right: odd positions ×3, even ×1 (position 1 = rightmost).
  for (let i = 0; i < body.length; i += 1) {
    const digit = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }
  return String((10 - (sum % 10)) % 10);
}

export function normalizeCompanyPrefix(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 10) {
    throw new Error("GS1 Company Prefix must be 6–10 digits");
  }
  return digits;
}

export function maxItemRefForPrefix(prefix: string): number {
  const itemLen = 12 - prefix.length;
  if (itemLen < 1) {
    throw new Error("Company prefix too long for GTIN-13");
  }
  return 10 ** itemLen - 1;
}

/** Build GTIN-13 from company prefix + item reference (1-based). */
export function buildGtin13(companyPrefix: string, itemRef: number): string {
  const prefix = normalizeCompanyPrefix(companyPrefix);
  const itemLen = 12 - prefix.length;
  const maxRef = maxItemRefForPrefix(prefix);
  const ref = Math.floor(Number(itemRef));
  if (!Number.isFinite(ref) || ref < 1 || ref > maxRef) {
    throw new Error(
      `GS1 item reference out of range (1–${maxRef}) for this prefix`,
    );
  }
  const item = String(ref).padStart(itemLen, "0");
  const body = `${prefix}${item}`;
  return `${body}${gtinCheckDigit(body)}`;
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

export function sanitizeAiValue(value: string, maxLen: number): string {
  return String(value ?? "")
    .replace(/[()]/g, "")
    .replace(/\s+/g, "")
    .slice(0, maxLen);
}

/** Human-readable GS1 AI element string for QR / scanners. */
export function buildGs1ElementString(
  gtin: string,
  lot: string,
  serial: string,
): string {
  const g14 = toGtin14(gtin);
  const lotAi = sanitizeAiValue(lot || "0", 20);
  const serAi = sanitizeAiValue(serial, 20);
  return `(01)${g14}(10)${lotAi}(21)${serAi}`;
}

/**
 * App-hosted GS1 Digital Link (hash router).
 * Path shape follows GS1 DL: /01/{gtin14}/21/{serial}?10={lot}
 */
export function buildGs1DigitalLink(opts: {
  publicBaseUrl: string;
  gtin: string;
  serial: string;
  lot?: string | null;
}): string {
  const g14 = toGtin14(opts.gtin);
  const base = opts.publicBaseUrl.replace(/\/$/, "");
  const serial = encodeURIComponent(sanitizeAiValue(opts.serial, 20));
  let url = `${base}/#/dl/01/${g14}/21/${serial}`;
  if (opts.lot) {
    url += `?10=${encodeURIComponent(sanitizeAiValue(opts.lot, 20))}`;
  }
  return url;
}

export function buildUnitQrPayload(opts: {
  publicBaseUrl: string;
  companySlug: string;
  serialCode: string;
  gtin?: string | null;
  lot?: string | null;
  gs1Enabled?: boolean;
}): { qrUrl: string; gs1ElementString: string | null; gtin: string | null } {
  const gtin = opts.gtin?.trim() || null;
  if (opts.gs1Enabled && gtin && validateGtin(gtin)) {
    return {
      qrUrl: buildGs1DigitalLink({
        publicBaseUrl: opts.publicBaseUrl,
        gtin,
        serial: opts.serialCode,
        lot: opts.lot,
      }),
      gs1ElementString: buildGs1ElementString(
        gtin,
        opts.lot || "0",
        opts.serialCode,
      ),
      gtin: gtin.replace(/\D/g, "").slice(-13),
    };
  }
  const base = opts.publicBaseUrl.replace(/\/$/, "");
  return {
    qrUrl: `${base}/#/unit/${opts.companySlug}/${encodeURIComponent(opts.serialCode)}`,
    gs1ElementString: null,
    gtin: null,
  };
}

/** Atomically allocate the next GTIN-13 for a company. */
export async function allocateNextGtin(
  companyId: string,
  tx: TxClient | typeof prisma = prisma,
): Promise<{ gtin: string; itemReference: string }> {
  const company = await tx.company.findUniqueOrThrow({
    where: { id: companyId },
    select: {
      gs1Enabled: true,
      gs1CompanyPrefix: true,
      gs1NextItemRef: true,
    },
  });
  if (!company.gs1Enabled || !company.gs1CompanyPrefix) {
    throw new Error("GS1 is not enabled — set company prefix first");
  }
  const prefix = normalizeCompanyPrefix(company.gs1CompanyPrefix);
  const maxRef = maxItemRefForPrefix(prefix);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const bumped = await tx.company.update({
      where: { id: companyId },
      data: { gs1NextItemRef: { increment: 1 } },
      select: { gs1NextItemRef: true },
    });
    const itemRef = bumped.gs1NextItemRef - 1;
    if (itemRef > maxRef) {
      throw new Error(
        "GS1 item references exhausted for this company prefix",
      );
    }
    const gtin = buildGtin13(prefix, itemRef);
    const taken = await tx.product.findFirst({
      where: { gtin },
      select: { id: true },
    });
    if (!taken) {
      const itemLen = 12 - prefix.length;
      return {
        gtin,
        itemReference: String(itemRef).padStart(itemLen, "0"),
      };
    }
  }
  throw new Error("Could not allocate a unique GTIN");
}

/** Assign GTINs to active products that do not have one yet. */
export async function backfillProductGtins(companyId: string) {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { gs1Enabled: true, gs1CompanyPrefix: true },
  });
  if (!company.gs1Enabled || !company.gs1CompanyPrefix) {
    return { assigned: 0 };
  }
  const missing = await prisma.product.findMany({
    where: { tenantId: companyId, gtin: null, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  let assigned = 0;
  for (const p of missing) {
    await prisma.$transaction(async (tx) => {
      const { gtin, itemReference } = await allocateNextGtin(companyId, tx);
      await tx.product.update({
        where: { id: p.id },
        data: { gtin, gs1ItemReference: itemReference },
      });
    });
    assigned += 1;
  }
  return { assigned };
}
