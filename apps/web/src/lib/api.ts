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
    cashBalanceBdt?: number;
  };
  lowStock: Product[];
  recentProducts: Product[];
};

export type StaffMember = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  employeeCode: string | null;
  designation: string | null;
  joiningDate: string | null;
  salaryBdt: number | null;
  isActive: boolean;
  createdAt: string;
  role: { code: string; nameEn: string; nameBn: string };
};

export type CashTransaction = {
  id: string;
  amountBdt: number;
  balanceAfter: number;
  note: string | null;
  reference: string | null;
  occurredAt: string;
  type: {
    code: string;
    nameEn: string;
    nameBn: string;
    direction: string;
  } | null;
};

export type WalletSummary = {
  id: string;
  balanceBdt: number;
  updatedAt?: string;
};

export type SalaryPaymentRow = {
  id: string;
  amountBdt: number;
  periodLabel: string | null;
  note: string | null;
  paidAt: string;
  staff: {
    id: string;
    name: string;
    email: string;
    role: string;
    salaryBdt: number | null;
  };
};

export type ProductionBatch = {
  id: string;
  productId: string;
  batchCode: string;
  manufacturedAt: string;
  expiresAt: string | null;
  qtyProduced: number;
  qtyRemaining: number;
  note: string | null;
  isActive: boolean;
  product: {
    id: string;
    name: string;
    nameBn: string | null;
    sku: string;
    priceBdt: number;
    description: string | null;
  } | null;
};

export type SalesOrderLine = {
  id: string;
  productId: string;
  batchId: string;
  qty: number;
  catalogPriceBdt: number;
  unitPriceBdt: number;
  lineTotalBdt: number;
  priceOverridden?: boolean;
  product: {
    name: string;
    nameBn: string | null;
    sku: string;
    description: string | null;
  } | null;
  batch: {
    batchCode: string;
    manufacturedAt: string;
    expiresAt: string | null;
  } | null;
};

export type SalesOrder = {
  id: string;
  invoiceNo?: string;
  buyerId: string | null;
  buyerName: string | null;
  totalBdt: number;
  note: string | null;
  orderedAt: string;
  confirmedAt: string | null;
  source: { code: string; nameEn: string; nameBn: string } | null;
  status: { code: string; nameEn: string; nameBn: string } | null;
  lines: SalesOrderLine[];
};

export type SalesInvoice = SalesOrder & {
  company: {
    name: string;
    phone: string | null;
    address: string | null;
    tagline: string | null;
  };
  buyer: { id: string; shopName: string; phone: string } | null;
  printedAt?: string;
};

export type TagTemplate = {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  showSku: boolean;
  showPrice: boolean;
  showDescription: boolean;
  showMfgDate: boolean;
  showExpDate: boolean;
  showBatch: boolean;
  showQr: boolean;
  showCompany: boolean;
  tagDescription: string | null;
  isDefault: boolean;
};

export type TagPreview = {
  size: { widthMm: number; heightMm: number };
  fields: {
    company: string | null;
    phone: string | null;
    productName: string;
    sku: string | null;
    priceBdt: number | null;
    description: string | null;
    batchCode: string | null;
    manufacturedAt: string | null;
    expiresAt: string | null;
    qrValue: string | null;
  };
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
    staff: () =>
      getJson<{ ok: boolean; staff: StaffMember[] }>(
        "/api/v1/owner/staff",
        2,
        undefined,
        true,
      ),
    createStaff: (body: Record<string, unknown>) =>
      getJson<{ ok: boolean; staff: StaffMember }>(
        "/api/v1/owner/staff",
        1,
        { method: "POST", body: JSON.stringify(body) },
        true,
      ),
    updateStaff: (id: string, body: Record<string, unknown>) =>
      getJson<{ ok: boolean; staff: StaffMember }>(
        `/api/v1/owner/staff/${id}`,
        1,
        { method: "PATCH", body: JSON.stringify(body) },
        true,
      ),
    deactivateStaff: (id: string) =>
      getJson<{ ok: boolean; staff: StaffMember }>(
        `/api/v1/owner/staff/${id}`,
        1,
        { method: "DELETE" },
        true,
      ),
    wallet: () =>
      getJson<{
        ok: boolean;
        wallet: WalletSummary;
        types: Array<{
          code: string;
          nameEn: string;
          nameBn: string;
          direction: string;
        }>;
        transactions: CashTransaction[];
      }>("/api/v1/owner/wallet", 2, undefined, true),
    adjustWallet: (body: Record<string, unknown>) =>
      getJson<{
        ok: boolean;
        wallet: WalletSummary;
        transaction: CashTransaction;
      }>("/api/v1/owner/wallet/adjust", 1, {
        method: "POST",
        body: JSON.stringify(body),
      }, true),
    recordSale: (body: Record<string, unknown>) =>
      getJson<{ ok: boolean; wallet: WalletSummary }>(
        "/api/v1/owner/wallet/sales",
        1,
        { method: "POST", body: JSON.stringify(body) },
        true,
      ),
    recordMaterial: (body: Record<string, unknown>) =>
      getJson<{ ok: boolean; wallet: WalletSummary }>(
        "/api/v1/owner/wallet/materials",
        1,
        { method: "POST", body: JSON.stringify(body) },
        true,
      ),
    payments: () =>
      getJson<{ ok: boolean; payments: SalaryPaymentRow[] }>(
        "/api/v1/owner/payments",
        2,
        undefined,
        true,
      ),
    paySalary: (body: Record<string, unknown>) =>
      getJson<{ ok: boolean; wallet: WalletSummary }>(
        "/api/v1/owner/payments",
        1,
        { method: "POST", body: JSON.stringify(body) },
        true,
      ),
    batches: (productId?: string) =>
      getJson<{ ok: boolean; batches: ProductionBatch[] }>(
        `/api/v1/owner/batches${productId ? `?productId=${productId}` : ""}`,
        2,
        undefined,
        true,
      ),
    createBatch: (body: Record<string, unknown>) =>
      getJson<{ ok: boolean; batch: ProductionBatch }>(
        "/api/v1/owner/batches",
        1,
        { method: "POST", body: JSON.stringify(body) },
        true,
      ),
    orders: () =>
      getJson<{ ok: boolean; orders: SalesOrder[] }>(
        "/api/v1/owner/orders",
        2,
        undefined,
        true,
      ),
    orderInvoice: (id: string) =>
      getJson<{ ok: boolean; invoice: SalesInvoice }>(
        `/api/v1/owner/orders/${id}/invoice`,
        2,
        undefined,
        true,
      ),
    confirmSell: (body: Record<string, unknown>) =>
      getJson<{
        ok: boolean;
        order: SalesOrder;
        sale: { id: string; amountBdt: number } | null;
        wallet: WalletSummary | null;
      }>("/api/v1/owner/sell", 1, {
        method: "POST",
        body: JSON.stringify(body),
      }, true),
    tagTemplates: () =>
      getJson<{ ok: boolean; templates: TagTemplate[] }>(
        "/api/v1/owner/tags/templates",
        2,
        undefined,
        true,
      ),
    createTagTemplate: (body: Record<string, unknown>) =>
      getJson<{ ok: boolean; template: TagTemplate }>(
        "/api/v1/owner/tags/templates",
        1,
        { method: "POST", body: JSON.stringify(body) },
        true,
      ),
    previewTag: (body: Record<string, unknown>) =>
      getJson<{ ok: boolean; tag: TagPreview }>(
        "/api/v1/owner/tags/preview",
        1,
        { method: "POST", body: JSON.stringify(body) },
        true,
      ),
  },
  publicTag: (companySlug: string, sku: string, batchCode: string) =>
    getJson<{
      ok: boolean;
      tag: {
        company: { name: string; phone: string | null; address: string | null };
        product: {
          name: string;
          nameBn: string | null;
          sku: string;
          unit: string;
          priceBdt: number;
          description: string | null;
        };
        batch: {
          batchCode: string;
          manufacturedAt: string;
          expiresAt: string | null;
          qtyRemaining: number;
        };
      };
    }>(
      `/api/v1/tag/${encodeURIComponent(companySlug)}/${encodeURIComponent(sku)}/${encodeURIComponent(batchCode)}`,
    ),
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
