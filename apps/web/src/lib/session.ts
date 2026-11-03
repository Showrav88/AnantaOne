const ACCESS_KEY = "anantaone.accessToken";
const REFRESH_KEY = "anantaone.refreshToken";
const USER_KEY = "anantaone.user";
const COMPANY_KEY = "anantaone.company";
const ACTIVE_BRANCH_KEY = "anantaone.activeBranchId";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  tenantId: string | null;
  branchId?: string | null;
  branch?: { id: string; name: string } | null;
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

export function getStoredCompany(): AuthCompany {
  const raw = localStorage.getItem(COMPANY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthCompany;
  } catch {
    return null;
  }
}

export function saveCompany(company: AuthCompany) {
  if (company) {
    localStorage.setItem(COMPANY_KEY, JSON.stringify(company));
  } else {
    localStorage.removeItem(COMPANY_KEY);
  }
}

export function saveSession(input: {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  company?: AuthCompany;
}) {
  localStorage.setItem(ACCESS_KEY, input.accessToken);
  localStorage.setItem(REFRESH_KEY, input.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(input.user));
  if (input.company !== undefined) {
    saveCompany(input.company);
  }
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(COMPANY_KEY);
  localStorage.removeItem(ACTIVE_BRANCH_KEY);
}

/** Owner active branch: `"all"` or a branch id. Staff ignore this (API uses assigned branch). */
export function getActiveBranchId(): string {
  const user = getStoredUser();
  if (user?.role.code !== "OWNER") {
    return user?.branchId ?? "";
  }
  return localStorage.getItem(ACTIVE_BRANCH_KEY) ?? "all";
}

export function setActiveBranchId(branchId: string) {
  localStorage.setItem(ACTIVE_BRANCH_KEY, branchId || "all");
  window.dispatchEvent(new Event("anantaone:branch-change"));
}

export function homePathForRole(roleCode: string) {
  if (roleCode === "SUPER_ADMIN") return "/admin";
  if (["OWNER", "MANAGER", "EMPLOYEE"].includes(roleCode)) return "/owner";
  return "/";
}
