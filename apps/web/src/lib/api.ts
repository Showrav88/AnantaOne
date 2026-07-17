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
  unit: string;
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

async function getJson<T>(path: string, attempts = 3, init?: RequestInit): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${apiUrl}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "X-Demo-Role": "OWNER",
          ...(init?.headers ?? {}),
        },
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
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
  owner: {
    dashboard: () =>
      getJson<{ ok: boolean; role: string; dashboard: OwnerDashboard }>(
        "/api/v1/owner/dashboard",
      ),
    company: () =>
      getJson<{ ok: boolean; company: CompanyDetails }>("/api/v1/owner/company"),
    updateCompany: (body: Partial<CompanyDetails>) =>
      getJson<{ ok: boolean; company: CompanyDetails }>("/api/v1/owner/company", 1, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    products: () =>
      getJson<{ ok: boolean; products: Product[] }>("/api/v1/owner/products"),
    createProduct: (body: Record<string, unknown>) =>
      getJson<{ ok: boolean; product: Product }>("/api/v1/owner/products", 1, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateProduct: (id: string, body: Record<string, unknown>) =>
      getJson<{ ok: boolean; product: Product }>(`/api/v1/owner/products/${id}`, 1, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deactivateProduct: (id: string) =>
      getJson<{ ok: boolean; product: Product }>(`/api/v1/owner/products/${id}`, 1, {
        method: "DELETE",
      }),
    buyers: () => getJson<BuyersResponse>("/api/v1/owner/buyers"),
  },
};
