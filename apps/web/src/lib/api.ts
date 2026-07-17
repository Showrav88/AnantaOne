import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  saveSession,
  type AuthCompany,
  type AuthUser,
} from "./session";

function normalizeApiUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (trimmed === "https://anantaone-api.onrender.com") {
    return "https://anantaoneapi.onrender.com";
  }
  return trimmed;
}

function resolveApiUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  if (fromEnv && fromEnv.trim()) {
    return normalizeApiUrl(fromEnv);
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "anantaone.onrender.com" || host.endsWith(".onrender.com")) {
      return "https://anantaoneapi.onrender.com";
    }
  }

  return "http://localhost:5000";
}

const apiUrl = resolveApiUrl();

export type HealthResponse = {
  ok: boolean;
  app?: string;
  env?: string;
};

export type DbHealthResponse = {
  ok: boolean;
  database?: string;
  message?: string;
};

export type OverviewResponse = {
  ok: boolean;
  message?: string;
  company?: {
    id: string;
    name: string;
    slug: string;
    locale: string;
    branches: Array<{ id: string; name: string; address: string | null }>;
    counts: { users: number; buyers: number };
  };
};

export type BuyersResponse = {
  ok: boolean;
  message?: string;
  buyers: Array<{
    id: string;
    shopName: string;
    phone: string;
    address: string | null;
    locale: string;
  }>;
};

export type Product = {
  id: string;
  name: string;
  nameBn: string | null;
  sku: string;
  category: string;
  unit: string | null;
  unitId?: string;
  priceBdt: number;
  stockQty: number;
  minStock: number;
  description: string | null;
  isActive: boolean;
};

export type CompanyDetails = {
  id: string;
  name: string;
  slug: string;
  locale: string;
  phone: string | null;
  address: string | null;
  tagline: string | null;
  description: string | null;
  branches: Array<{ id: string; name: string; address: string | null }>;
  counts: { users: number; buyers: number; products: number };
};

export type OwnerDashboard = {
  company: CompanyDetails;
  stats: {
    products: number;
    buyers: number;
    lowStock: number;
    users: number;
  };
  lowStock: Product[];
  recentProducts: Product[];
};

type AuthResponse = {
  ok: boolean;
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  company: AuthCompany;
};

async function rawFetch(path: string, init?: RequestInit) {
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(45_000),
  });
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const res = await rawFetch("/api/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearSession();
    return false;
  }
  const data = (await res.json()) as AuthResponse;
  saveSession({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  });
  return true;
}

async function getJson<T>(
  path: string,
  attempts = 3,
  init?: RequestInit,
  auth = false,
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i += 1) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (auth) {
        const token = getAccessToken();
        if (token) headers.Authorization = `Bearer ${token}`;
      }

      let res = await rawFetch(path, {
        ...init,
        headers: { ...headers, ...(init?.headers as Record<string, string>) },
      });

      if (auth && res.status === 401) {
        const ok = await refreshAccessToken();
        if (ok) {
          headers.Authorization = `Bearer ${getAccessToken()}`;
          res = await rawFetch(path, {
            ...init,
            headers: {
              ...headers,
              ...(init?.headers as Record<string, string>),
            },
          });
        }
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("API request failed");
}

export const api = {
  baseUrl: apiUrl,
  health: () => getJson<HealthResponse>("/health"),
  healthDb: () => getJson<DbHealthResponse>("/health/db"),
  overview: () => getJson<OverviewResponse>("/api/v1/overview"),
  buyers: () => getJson<BuyersResponse>("/api/v1/buyers"),
  products: () =>
    getJson<{ ok: boolean; products: Product[] }>("/api/v1/products"),
  auth: {
    register: async (body: Record<string, unknown>) => {
      const data = await getJson<AuthResponse>("/api/v1/auth/register", 1, {
        method: "POST",
        body: JSON.stringify(body),
      });
      saveSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
      return data;
    },
    login: async (body: { email: string; password: string }) => {
      const data = await getJson<AuthResponse>("/api/v1/auth/login", 1, {
        method: "POST",
        body: JSON.stringify(body),
      });
      saveSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
      return data;
    },
    logout: async () => {
      try {
        await getJson(
          "/api/v1/auth/logout",
          1,
          {
            method: "POST",
            body: JSON.stringify({ refreshToken: getRefreshToken() }),
          },
          true,
        );
      } finally {
        clearSession();
      }
    },
    me: () =>
      getJson<{ ok: boolean; user: AuthUser; company: AuthCompany }>(
        "/api/v1/auth/me",
        1,
        undefined,
        true,
      ),
    units: () =>
      getJson<{
        ok: boolean;
        units: Array<{ id: string; code: string; nameEn: string; nameBn: string }>;
      }>("/api/v1/auth/lookups/units"),
  },
  owner: {
    dashboard: () =>
      getJson<{ ok: boolean; role: string; dashboard: OwnerDashboard }>(
        "/api/v1/owner/dashboard",
        2,
        undefined,
        true,
      ),
    company: () =>
      getJson<{ ok: boolean; company: CompanyDetails }>(
        "/api/v1/owner/company",
        2,
        undefined,
        true,
      ),
    updateCompany: (body: Partial<CompanyDetails>) =>
      getJson<{ ok: boolean; company: CompanyDetails }>(
        "/api/v1/owner/company",
        1,
        { method: "PATCH", body: JSON.stringify(body) },
        true,
      ),
    products: () =>
      getJson<{ ok: boolean; products: Product[] }>(
        "/api/v1/owner/products",
        2,
        undefined,
        true,
      ),
    createProduct: (body: Record<string, unknown>) =>
      getJson<{ ok: boolean; product: Product }>(
        "/api/v1/owner/products",
        1,
        { method: "POST", body: JSON.stringify(body) },
        true,
      ),
    updateProduct: (id: string, body: Record<string, unknown>) =>
      getJson<{ ok: boolean; product: Product }>(
        `/api/v1/owner/products/${id}`,
        1,
        { method: "PATCH", body: JSON.stringify(body) },
        true,
      ),
    deactivateProduct: (id: string) =>
      getJson<{ ok: boolean; product: Product }>(
        `/api/v1/owner/products/${id}`,
        1,
        { method: "DELETE" },
        true,
      ),
    buyers: () =>
      getJson<BuyersResponse>("/api/v1/owner/buyers", 2, undefined, true),
  },
  admin: {
    dashboard: () =>
      getJson<{
        ok: boolean;
        dashboard: {
          stats: {
            companies: number;
            users: number;
            buyers: number;
            products: number;
          };
        };
      }>("/api/v1/admin/dashboard", 2, undefined, true),
    companies: () =>
      getJson<{
        ok: boolean;
        companies: Array<{
          id: string;
          name: string;
          slug: string;
          phone: string | null;
          address: string | null;
          isActive: boolean;
          counts: { users: number; buyers: number; products: number };
          owner: { id: string; name: string; email: string } | null;
        }>;
      }>("/api/v1/admin/companies", 2, undefined, true),
    setCompanyActive: (id: string, isActive: boolean) =>
      getJson<{ ok: boolean }>(
        `/api/v1/admin/companies/${id}`,
        1,
        { method: "PATCH", body: JSON.stringify({ isActive }) },
        true,
      ),
  },
  sessionUser: getStoredUser,
};
