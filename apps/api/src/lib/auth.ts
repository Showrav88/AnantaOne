import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const accessSecret = process.env.JWT_SECRET ?? "dev-access-secret-change-me";
const refreshSecret =
  process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me";

export const ACCESS_TOKEN_TTL = "8h";
export const REFRESH_TOKEN_TTL_DAYS = 30;

export type AccessClaims = {
  sub: string;
  email: string;
  roleCode: string;
  roleScope: string;
  tenantId: string | null;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function signAccessToken(claims: AccessClaims) {
  return jwt.sign(claims, accessSecret, { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessClaims {
  return jwt.verify(token, accessSecret) as AccessClaims;
}

export function createRefreshTokenValue() {
  return crypto.randomBytes(48).toString("hex");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function signRefreshToken(userId: string, tokenId: string) {
  return jwt.sign({ sub: userId, jti: tokenId }, refreshSecret, {
    expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d`,
  });
}

export function verifyRefreshToken(token: string): { sub: string; jti: string } {
  return jwt.verify(token, refreshSecret) as { sub: string; jti: string };
}

export function slugifyCompanyName(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\u0980-\u09FF]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || `company-${Date.now()}`;
}
