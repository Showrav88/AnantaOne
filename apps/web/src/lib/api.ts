const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

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

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export const api = {
  baseUrl: apiUrl,
  health: () => getJson<HealthResponse>("/health"),
  healthDb: () => getJson<DbHealthResponse>("/health/db"),
  overview: () => getJson<OverviewResponse>("/api/v1/overview"),
  buyers: () => getJson<BuyersResponse>("/api/v1/buyers"),
};
