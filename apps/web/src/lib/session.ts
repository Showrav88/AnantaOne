const ACCESS_KEY = "anantaone.accessToken";
const REFRESH_KEY = "anantaone.refreshToken";
const USER_KEY = "anantaone.user";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  tenantId: string | null;
  role: {
    code: string;
    nameEn: string;
    nameBn: string;
    scope: string;
  };
};

export type AuthCompany = {
  id: string;
  name: string;
  slug: string;
  isActive?: boolean;
} | null;

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveSession(input: {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}) {
  localStorage.setItem(ACCESS_KEY, input.accessToken);
  localStorage.setItem(REFRESH_KEY, input.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(input.user));
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function homePathForRole(roleCode: string) {
  if (roleCode === "SUPER_ADMIN") return "/admin";
  if (["OWNER", "MANAGER", "EMPLOYEE"].includes(roleCode)) return "/owner";
  return "/";
}
