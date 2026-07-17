function normalizeApiUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  // Common Render mistake: AnantaOneApi → anantaone-api (404 host)
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

async function getJson<T>(path: string, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${apiUrl}${path}`, {
        // Render free tier cold-start can be slow
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
      // Brief backoff before retry (cold start / transient network)
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
};
