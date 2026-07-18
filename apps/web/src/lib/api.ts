import {
  clearSession,
  getAccessToken,
  getActiveBranchId,
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
  branches: Array<{
    id: string;
    name: string;
    address: string | null;
    phone?: string | null;
    isActive?: boolean;
    managerId?: string | null;
  }>;
  counts: { users: number; buyers: number };
};
};

export type BuyerRow = {
  id: string;
  shopName: string;
  contactName: string | null;
  phone: string;
  address: string | null;
  wardId: string | null;
  ward: { id: string; name: string; nameBn: string | null } | null;
  locale: string;
  isActive: boolean;
  orderCount: number;
  totalSpentBdt: number;
};

export type BuyersResponse = {
  ok: boolean;
  message?: string;
  buyers: BuyerRow[];
};

export type Product = {
  id: string;
  name: string;
  nameBn: string | null;
  sku: string;
  category: string;
  imageUrl?: string | null;
  imagePublicId?: string | null;
  unit: string | null;
  unitId?: string;
  unitLabel?: { en: string; bn: string } | null;
  size: number | null;
  priceBdt: number;
  stockQty: number;
  minStock: number;
  description: string | null;
  isActive: boolean;
  createdAt?: string;
};

export type GeoPlace = {
  id: string;
  code?: string;
  name: string;
  nameBn: string | null;
  divisionId?: string;
  districtId?: string;
};

export type CompanyDetails = {
  id: string;
  name: string;
  slug: string;
  locale: string;
  phone: string | null;
  address: string | null;
  divisionId?: string | null;
  districtId?: string | null;
  upazilaId?: string | null;
  division?: GeoPlace | null;
  district?: GeoPlace | null;
  upazila?: GeoPlace | null;
  tagline: string | null;
  description: string | null;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  heroVideoUrl?: string | null;
  brandPrimary?: string | null;
  brandAccent?: string | null;
  brandBg?: string | null;
  brandFont?: string | null;
  siteHeadline?: string | null;
  siteSubhead?: string | null;
  branches: Array<{
    id: string;
    name: string;
    address: string | null;
    phone?: string | null;
    isActive?: boolean;
    managerId?: string | null;
  }>;
  counts: { users: number; buyers: number; products: number };
};

export type BranchStaffBrief = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  role: { code: string; nameEn: string; nameBn: string };
};

export type BranchRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  managerId: string | null;
  manager: BranchStaffBrief | null;
  staff: BranchStaffBrief[];
  employees: BranchStaffBrief[];
  managers: BranchStaffBrief[];
  createdAt: string;
  updatedAt: string;
};

export type MediaAsset = {
  id: string;
  kind: "IMAGE" | "VIDEO" | string;
  url: string;
  publicId: string;
  folder: string;
  format: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  originalName: string | null;
  label: string | null;
  createdAt: string;
};

export type ShopBranding = {
  id: string;
  name: string;
  slug: string;
  locale: string;
  phone: string | null;
  address: string | null;
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  logoPublicId: string | null;
  heroImageUrl: string | null;
  heroImagePublicId: string | null;
  heroVideoUrl: string | null;
  heroVideoPublicId: string | null;
  brandPrimary: string;
  brandAccent: string;
  brandBg: string;
  brandFont: string;
  siteHeadline: string | null;
  siteSubhead: string | null;
  cloudinaryReady: boolean;
  publicShopPath: string;
};

export type ShopWard = {
  id: string;
  name: string;
  nameBn: string | null;
  districtId?: string | null;
  upazilaId?: string | null;
  freeDelivery: boolean;
  baseChargeBdt: number;
};

export type ShopProduct = {
  id: string;
  name: string;
  nameBn: string | null;
  sku: string;
  category: string;
  unit: string;
  priceBdt: number;
  stockQty?: number;
  description: string | null;
  imageUrl: string | null;
};

export type DeliveryQuote = {
  subtotalBdt: number;
  deliveryBdt: number;
  discountBdt: number;
  totalBdt: number;
  freeDelivery: boolean;
  zone?: string;
  zoneLabel?: string;
  ward: ShopWard | null;
  coupon: {
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
  } | null;
  breakdown: Array<{
    category: string;
    qty: number;
    chargePerUnitBdt: number;
    lineDeliveryBdt: number;
  }>;
};

export type PublicShop = {
  name: string;
  slug: string;
  locale: string;
  phone: string | null;
  address: string | null;
  divisionId?: string | null;
  districtId?: string | null;
  upazilaId?: string | null;
  division?: { id: string; name: string; nameBn: string | null } | null;
  district?: { id: string; name: string; nameBn: string | null } | null;
  upazila?: { id: string; name: string; nameBn: string | null } | null;
  deliveryCharges?: {
    outsideAreaBdt: number;
    sameDistrictBdt: number;
    otherDistrictBdt: number;
  };
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  heroVideoUrl: string | null;
  brandPrimary: string;
  brandAccent: string;
  brandBg: string;
  brandFont: string;
  siteHeadline: string;
  siteSubhead: string | null;
  branches: Array<{ id: string; name: string; address: string | null }>;
  wards: ShopWard[];
  products: ShopProduct[];
};

export type OwnerDashboard = {
  company: CompanyDetails;
  stats: {
    products: number;
    buyers?: number;
    lowStock?: number;
    users: number;
    cashBalanceBdt?: number;
    branchOrders?: number;
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
  imageUrl: string | null;
  imagePublicId: string | null;
  isActive: boolean;
  createdAt: string;
  branchId: string | null;
  branch: { id: string; name: string } | null;
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

export type SupplyPurchase = {
  id: string;
  materialName: string;
  supplierName: string | null;
  supplierPhone: string | null;
  qty: number;
  goodsAmountBdt: number;
  transportBdt: number;
  driverBdt: number;
  travelBdt: number;
  amountBdt: number;
  landedUnitCostBdt: number | null;
  purchasedAt: string;
  note: string | null;
  isReversed?: boolean;
  reverseReason?: string | null;
  reversedAt?: string | null;
  kind: { code: string; nameEn: string; nameBn: string } | null;
  unit: { code: string; nameEn: string; nameBn: string } | null;
  breakdown: {
    goodsBdt: number;
    transportBdt: number;
    driverBdt: number;
    travelBdt: number;
    totalBdt: number;
  };
};

export type WalletAnalytics = {
  ok: boolean;
  days: number;
  since: string;
  wallet: WalletSummary;
  totals: {
    salesCreditBdt: number;
    materialTotalBdt: number;
    materialGoodsBdt: number;
    materialTransportBdt: number;
    materialDriverBdt: number;
    materialTravelBdt: number;
    standaloneTransportBdt: number;
    utilityBdt: number;
    otherExpenseBdt: number;
    salaryBdt: number;
    otherCreditBdt: number;
    otherDebitBdt: number;
    netCashFlowBdt: number;
  };
  bySupplyKind: Array<{
    code: string;
    nameEn: string;
    nameBn: string;
    totalBdt: number;
    qty: number;
  }>;
  byExpenseCategory: Array<{
    code: string;
    nameEn: string;
    nameBn: string;
    totalBdt: number;
    count: number;
  }>;
  purchases: SupplyPurchase[];
  transactions: Array<
    CashTransaction & {
      detailType: string;
      detail: unknown;
    }
  >;
};

export type SalaryPaymentRow = {
  id: string;
  amountBdt: number;
  periodLabel: string | null;
  note: string | null;
  paidAt: string;
  isReversed?: boolean;
  reverseReason?: string | null;
  reversedAt?: string | null;
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
  serialStart: number | null;
  serialEnd: number | null;
  unitTagCount?: number | null;
  note: string | null;
  isActive: boolean;
  reversedAt?: string | null;
  reverseReason?: string | null;
  product: {
    id: string;
    name: string;
    nameBn: string | null;
    sku: string;
    size?: number | null;
    priceBdt: number;
    description: string | null;
  } | null;
};

export type ProductUnitTag = {
  id: string;
  serialNo: number;
  serialCode: string;
  status: string;
  soldAt: string | null;
  qrUrl: string;
  product: {
    name: string;
    nameBn: string | null;
    sku: string;
    size: number | null;
    unit: string | null;
    unitLabel: { en: string; bn: string } | null;
    priceBdt: number | null;
  } | null;
  batch: {
    batchCode: string;
    manufacturedAt: string;
    expiresAt: string | null;
    serialStart: number | null;
    serialEnd: number | null;
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
  invoiceCode?: string;
  buyerId: string | null;
  buyerName: string | null;
  totalBdt: number;
  note: string | null;
  orderedAt: string;
  confirmedAt: string | null;
  reverseReason?: string | null;
  reversedAt?: string | null;
  isReversed?: boolean;
  source: { code: string; nameEn: string; nameBn: string } | null;
  status: { code: string; nameEn: string; nameBn: string } | null;
  lines: SalesOrderLine[];
};

export type SalesInvoice = SalesOrder & {
  company: {
    name: string;
    slug?: string;
    phone: string | null;
    address: string | null;
    tagline: string | null;
  };
  buyer: { id: string; shopName: string; phone: string } | null;
  qrValue?: string | null;
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
        if (path.startsWith("/api/v1/owner")) {
          const branchId = getActiveBranchId();
          if (branchId) headers["X-Branch-Id"] = branchId;
        }
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

/** Multipart upload — do not set Content-Type (browser sets boundary). */
async function postForm<T>(path: string, form: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (path.startsWith("/api/v1/owner")) {
    const branchId = getActiveBranchId();
    if (branchId) headers["X-Branch-Id"] = branchId;
  }

  let res = await rawFetch(path, { method: "POST", headers, body: form });
  if (res.status === 401) {
    const ok = await refreshAccessToken();
    if (ok) {
      headers.Authorization = `Bearer ${getAccessToken()}`;
      res = await rawFetch(path, { method: "POST", headers, body: form });
    }
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    if (res.status === 413) {
      throw new Error(
        body?.message ??
          "File too large (HTTP 413). Use a smaller photo — the app will compress images automatically.",
      );
    }
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export const api = {
  baseUrl: apiUrl,
  health: () => getJson<HealthResponse>("/health"),
  healthDb: () => getJson<DbHealthResponse>("/health/db"),
  overview: () => getJson<OverviewResponse>("/api/v1/overview"),
  publicShop: (companySlug: string) =>
    getJson<{ ok: boolean; shop: PublicShop }>(
      `/api/v1/shop/${encodeURIComponent(companySlug)}`,
    ),
  publicShopProduct: (companySlug: string, productId: string) =>
    getJson<{ ok: boolean; product: ShopProduct }>(
      `/api/v1/shop/${encodeURIComponent(companySlug)}/products/${encodeURIComponent(productId)}`,
    ),
  geo: {
    divisions: () =>
      getJson<{ ok: boolean; divisions: GeoPlace[] }>("/api/v1/geo/divisions"),
    districts: (divisionId?: string) =>
      getJson<{ ok: boolean; districts: GeoPlace[] }>(
        `/api/v1/geo/districts${divisionId ? `?divisionId=${encodeURIComponent(divisionId)}` : ""}`,
      ),
    upazilas: (districtId: string) =>
      getJson<{ ok: boolean; upazilas: GeoPlace[] }>(
        `/api/v1/geo/upazilas?districtId=${encodeURIComponent(districtId)}`,
      ),
  },
  shopQuote: (
    companySlug: string,
    body: {
      districtId?: string | null;
      upazilaId?: string | null;
      wardId?: string | null;
      branchId?: string | null;
      couponCode?: string | null;
      lines: Array<{ productId: string; qty: number }>;
    },
  ) =>
    getJson<{ ok: boolean; quote: DeliveryQuote }>(
      `/api/v1/shop/${encodeURIComponent(companySlug)}/quote`,
      1,
      { method: "POST", body: JSON.stringify(body) },
    ),
  shopCheckout: (
    companySlug: string,
    body: {
      shopName: string;
      clientName: string;
      phone: string;
      address: string;
      districtId?: string | null;
      upazilaId?: string | null;
      wardId?: string | null;
      branchId?: string | null;
      couponCode?: string | null;
      note?: string | null;
      lines: Array<{ productId: string; qty: number }>;
    },
  ) =>
    getJson<{ ok: boolean; quote: DeliveryQuote; order: { invoiceCode: string; id: string; totalBdt: number } }>(
      `/api/v1/shop/${encodeURIComponent(companySlug)}/checkout`,
      1,
      { method: "POST", body: JSON.stringify(body) },
    ),
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
    updateCompany: (
      body: Partial<CompanyDetails> & {
        setupDeliveryAreas?: boolean;
        wardCount?: number;
        freeWardCount?: number;
      },
    ) =>
      getJson<{ ok: boolean; company: CompanyDetails; wardsSeeded?: number }>(
        "/api/v1/owner/company",
        1,
        { method: "PATCH", body: JSON.stringify(body) },
        true,
      ),
    branding: () =>
      getJson<{ ok: boolean; branding: ShopBranding }>(
        "/api/v1/owner/branding",
        2,
        undefined,
        true,
      ),
    updateBranding: (body: Record<string, unknown>) =>
      getJson<{ ok: boolean; branding: ShopBranding }>(
        "/api/v1/owner/branding",
        1,
        { method: "PATCH", body: JSON.stringify(body) },
        true,
      ),
    media: () =>
      getJson<{
        ok: boolean;
        cloudinaryReady: boolean;
        assets: MediaAsset[];
      }>("/api/v1/owner/media", 2, undefined, true),
    mediaStatus: () =>
      getJson<{
        ok: boolean;
        cloudinaryReady: boolean;
        cloudName?: string;
        apiKeyHint?: string;
        source?: string;
        message?: string;
      }>("/api/v1/owner/media/status", 1, undefined, true),
    uploadMedia: (file: File, purpose = "assets", label?: string) => {
      const form = new FormData();
      form.append("file", file);
      form.append("purpose", purpose);
      if (label) form.append("label", label);
      return postForm<{ ok: boolean; asset: MediaAsset }>(
        "/api/v1/owner/media",
        form,
      );
    },
    signMedia: (body: {
      purpose: "assets" | "logo" | "hero" | "products" | "staff";
      publicId?: string;
    }) =>
      getJson<{
        ok: boolean;
        sign: {
          cloudName: string;
          apiKey: string;
          timestamp: number;
          signature: string;
          folder: string;
          publicId?: string;
        };
      }>("/api/v1/owner/media/sign", 1, {
        method: "POST",
        body: JSON.stringify(body),
      }, true),
    registerMedia: (body: Record<string, unknown>) =>
      getJson<{ ok: boolean; asset: MediaAsset }>(
        "/api/v1/owner/media/register",
        1,
        { method: "POST", body: JSON.stringify(body) },
        true,
      ),
    deleteMedia: (id: string) =>
      getJson<{ ok: boolean }>(
        `/api/v1/owner/media/${encodeURIComponent(id)}`,
        1,
        { method: "DELETE" },
        true,
      ),
    uploadProductImage: (productId: string, file: File) => {
      const form = new FormData();
      form.append("file", file);
      return postForm<{
        ok: boolean;
        product: { id: string; imageUrl: string | null; sku: string };
      }>(`/api/v1/owner/products/${encodeURIComponent(productId)}/image`, form);
    },
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
    createBuyer: (body: Record<string, unknown>) =>
      getJson<{ ok: boolean; buyer: BuyerRow }>(
        "/api/v1/owner/buyers",
        1,
        { method: "POST", body: JSON.stringify(body) },
        true,
      ),
    updateBuyer: (id: string, body: Record<string, unknown>) =>
      getJson<{ ok: boolean; buyer: BuyerRow }>(
        `/api/v1/owner/buyers/${id}`,
        1,
        { method: "PATCH", body: JSON.stringify(body) },
        true,
      ),
    buyerAnalytics: () =>
      getJson<{
        ok: boolean;
        analytics: {
          buyerCount: number;
          totalRevenueBdt: number;
          buyers: Array<{
            id: string;
            shopName: string;
            contactName: string | null;
            phone: string;
            ward: { id: string; name: string; nameBn: string | null } | null;
            orderCount: number;
            totalSpentBdt: number;
            onlineSpentBdt: number;
            lastOrderAt: string | null;
          }>;
        };
      }>("/api/v1/owner/buyers/analytics", 2, undefined, true),
    deliveryWards: (branchId?: string) =>
      getJson<{
        ok: boolean;
        wards: Array<{
          id: string;
          branchId: string | null;
          name: string;
          nameBn: string | null;
          sortOrder: number;
          freeDelivery: boolean;
          baseChargeBdt: number;
          isActive: boolean;
        }>;
      }>(
        `/api/v1/owner/delivery/wards${branchId ? `?branchId=${encodeURIComponent(branchId)}` : ""}`,
        2,
        undefined,
        true,
      ),
    createDeliveryWard: (body: Record<string, unknown>) =>
      getJson<{ ok: boolean; ward: Record<string, unknown> }>(
        "/api/v1/owner/delivery/wards",
        1,
        { method: "POST", body: JSON.stringify(body) },
        true,
      ),
    updateDeliveryWard: (id: string, body: Record<string, unknown>) =>
      getJson<{ ok: boolean; ward: Record<string, unknown> }>(
        `/api/v1/owner/delivery/wards/${id}`,
        1,
        { method: "PATCH", body: JSON.stringify(body) },
        true,
      ),
    seedDeliveryArea: (body?: {
      branchId?: string | null;
      districtId?: string;
      upazilaId?: string;
      wardCount?: number;
      freeWardCount?: number;
    }) =>
      getJson<{ ok: boolean; wards: unknown[] }>(
        "/api/v1/owner/delivery/wards/seed-area",
        1,
        {
          method: "POST",
          body: JSON.stringify(body ?? {}),
        },
        true,
      ),
    seedLakshmipurWards: (branchId?: string | null) =>
      getJson<{ ok: boolean; wards: unknown[] }>(
        "/api/v1/owner/delivery/wards/seed-lakshmipur",
        1,
        {
          method: "POST",
          body: JSON.stringify({ branchId: branchId ?? null }),
        },
        true,
      ),
    deliverySettings: () =>
      getJson<{
        ok: boolean;
        settings: {
          outsideAreaChargeBdt: number;
          sameDistrictChargeBdt: number;
          otherDistrictChargeBdt: number;
          defaultWardCount: number;
          freeWardCount: number;
        };
      }>("/api/v1/owner/delivery/settings", 2, undefined, true),
    updateDeliverySettings: (body: Record<string, unknown>) =>
      getJson<{
        ok: boolean;
        settings: {
          outsideAreaChargeBdt: number;
          sameDistrictChargeBdt: number;
          otherDistrictChargeBdt: number;
          defaultWardCount: number;
          freeWardCount: number;
        };
      }>(
        "/api/v1/owner/delivery/settings",
        1,
        { method: "PATCH", body: JSON.stringify(body) },
        true,
      ),
    deliveryRates: () =>
      getJson<{
        ok: boolean;
        rates: Array<{
          id: string;
          category: string;
          chargePerUnitBdt: number;
          note: string | null;
          isActive: boolean;
        }>;
      }>("/api/v1/owner/delivery/rates", 2, undefined, true),
    upsertDeliveryRate: (body: Record<string, unknown>) =>
      getJson<{ ok: boolean; rate: Record<string, unknown> }>(
        "/api/v1/owner/delivery/rates",
        1,
        { method: "POST", body: JSON.stringify(body) },
        true,
      ),
    coupons: () =>
      getJson<{
        ok: boolean;
        coupons: Array<{
          id: string;
          code: string;
          discountType: string;
          discountValue: number;
          minOrderBdt: number | null;
          maxDiscountBdt: number | null;
          usageLimit: number | null;
          usedCount: number;
          isActive: boolean;
        }>;
      }>("/api/v1/owner/coupons", 2, undefined, true),
    createCoupon: (body: Record<string, unknown>) =>
      getJson<{ ok: boolean; coupon: Record<string, unknown> }>(
        "/api/v1/owner/coupons",
        1,
        { method: "POST", body: JSON.stringify(body) },
        true,
      ),
    updateCoupon: (id: string, body: Record<string, unknown>) =>
      getJson<{ ok: boolean; coupon: Record<string, unknown> }>(
        `/api/v1/owner/coupons/${id}`,
        1,
        { method: "PATCH", body: JSON.stringify(body) },
        true,
      ),
    onlineOrders: (status?: string) =>
      getJson<{ ok: boolean; orders: Array<Record<string, unknown>> }>(
        `/api/v1/owner/online-orders${status ? `?status=${encodeURIComponent(status)}` : ""}`,
        2,
        undefined,
        true,
      ),
    acceptOnlineOrder: (id: string) =>
      getJson<{ ok: boolean; order: Record<string, unknown> }>(
        `/api/v1/owner/online-orders/${id}/accept`,
        1,
        { method: "POST", body: JSON.stringify({}) },
        true,
      ),
    setOnlineOrderStatus: (id: string, statusCode: string) =>
      getJson<{ ok: boolean; order: Record<string, unknown> }>(
        `/api/v1/owner/online-orders/${id}/status`,
        1,
        {
          method: "POST",
          body: JSON.stringify({ statusCode }),
        },
        true,
      ),
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
    branches: () =>
      getJson<{ ok: boolean; branches: BranchRow[] }>(
        "/api/v1/owner/branches",
        2,
        undefined,
        true,
      ),
    createBranch: (body: Record<string, unknown>) =>
      getJson<{ ok: boolean; branch: BranchRow }>(
        "/api/v1/owner/branches",
        1,
        { method: "POST", body: JSON.stringify(body) },
        true,
      ),
    updateBranch: (id: string, body: Record<string, unknown>) =>
      getJson<{ ok: boolean; branch: BranchRow }>(
        `/api/v1/owner/branches/${id}`,
        1,
        { method: "PATCH", body: JSON.stringify(body) },
        true,
      ),
    deactivateBranch: (id: string) =>
      getJson<{ ok: boolean; branch: BranchRow }>(
        `/api/v1/owner/branches/${id}`,
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
      getJson<{ ok: boolean; wallet: WalletSummary; purchase: SupplyPurchase }>(
        "/api/v1/owner/wallet/materials",
        1,
        { method: "POST", body: JSON.stringify(body) },
        true,
      ),
    updateMaterial: (id: string, body: Record<string, unknown>) =>
      getJson<{
        ok: boolean;
        wallet: WalletSummary;
        purchase: SupplyPurchase;
        walletDeltaBdt: number;
      }>(
        `/api/v1/owner/wallet/materials/${encodeURIComponent(id)}`,
        1,
        { method: "PATCH", body: JSON.stringify(body) },
        true,
      ),
    reverseMaterial: (id: string, reason: string) =>
      getJson<{
        ok: boolean;
        wallet: WalletSummary;
        purchase: SupplyPurchase;
        cashCreditedBdt: number;
      }>(
        `/api/v1/owner/wallet/materials/${encodeURIComponent(id)}/reverse`,
        1,
        { method: "POST", body: JSON.stringify({ reason }) },
        true,
      ),
    supplyMeta: () =>
      getJson<{
        ok: boolean;
        kinds: Array<{
          code: string;
          nameEn: string;
          nameBn: string;
          description: string | null;
        }>;
        units: Array<{ code: string; nameEn: string; nameBn: string }>;
      }>("/api/v1/owner/wallet/supply-meta", 2, undefined, true),
    supplyPurchases: () =>
      getJson<{ ok: boolean; purchases: SupplyPurchase[] }>(
        "/api/v1/owner/wallet/purchases",
        2,
        undefined,
        true,
      ),
    walletAnalytics: (days = 90) =>
      getJson<WalletAnalytics>(
        `/api/v1/owner/wallet/analytics?days=${days}`,
        2,
        undefined,
        true,
      ),
    expenseCategories: () =>
      getJson<{
        ok: boolean;
        categories: Array<{
          code: string;
          nameEn: string;
          nameBn: string;
          description: string | null;
        }>;
      }>("/api/v1/owner/wallet/expense-categories", 2, undefined, true),
    recordExpense: (body: Record<string, unknown>) =>
      getJson<{ ok: boolean; wallet: WalletSummary }>(
        "/api/v1/owner/wallet/expenses",
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
    reverseSalary: (id: string, reason: string) =>
      getJson<{
        ok: boolean;
        cashCreditedBdt?: number;
        wallet: WalletSummary | null;
        payment: SalaryPaymentRow;
      }>(
        `/api/v1/owner/payments/${id}/reverse`,
        1,
        { method: "POST", body: JSON.stringify({ reason }) },
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
    updateBatch: (id: string, body: Record<string, unknown>) =>
      getJson<{ ok: boolean; batch: ProductionBatch }>(
        `/api/v1/owner/batches/${id}`,
        1,
        { method: "PATCH", body: JSON.stringify(body) },
        true,
      ),
    reverseBatch: (id: string, reason: string) =>
      getJson<{ ok: boolean; batch: ProductionBatch; stockRemoved: number }>(
        `/api/v1/owner/batches/${id}/reverse`,
        1,
        { method: "POST", body: JSON.stringify({ reason }) },
        true,
      ),
    batchUnits: (id: string, opts?: { status?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (opts?.status) q.set("status", opts.status);
      if (opts?.limit) q.set("limit", String(opts.limit));
      const qs = q.toString();
      return getJson<{
        ok: boolean;
        batch: ProductionBatch;
        units: ProductUnitTag[];
      }>(
        `/api/v1/owner/batches/${id}/units${qs ? `?${qs}` : ""}`,
        1,
        undefined,
        true,
      );
    },
    createUnit: (body: {
      code: string;
      nameEn: string;
      nameBn: string;
    }) =>
      getJson<{
        ok: boolean;
        unit: { id: string; code: string; nameEn: string; nameBn: string };
      }>("/api/v1/owner/units", 1, {
        method: "POST",
        body: JSON.stringify(body),
      }, true),
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
    lookupInvoice: (q: string) =>
      getJson<{ ok: boolean; invoice: SalesInvoice }>(
        `/api/v1/owner/invoices/lookup?q=${encodeURIComponent(q)}`,
        1,
        undefined,
        true,
      ),
    reverseOrder: (id: string, reason: string) =>
      getJson<{
        ok: boolean;
        order: SalesOrder;
        cashDebitedBdt?: number;
        restocked?: Array<{ productId: string; batchId: string; qty: number }>;
        wallet: WalletSummary | null;
      }>(
        `/api/v1/owner/orders/${id}/reverse`,
        1,
        { method: "POST", body: JSON.stringify({ reason }) },
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
          size?: number | null;
          unit: string;
          unitLabel?: { en: string; bn: string };
          priceBdt: number;
          description: string | null;
        };
        batch: {
          batchCode: string;
          manufacturedAt: string;
          expiresAt: string | null;
          qtyRemaining: number;
          serialStart?: number | null;
          serialEnd?: number | null;
        };
      };
    }>(
      `/api/v1/tag/${encodeURIComponent(companySlug)}/${encodeURIComponent(sku)}/${encodeURIComponent(batchCode)}`,
    ),
  publicUnit: (companySlug: string, serialCode: string) =>
    getJson<{
      ok: boolean;
      unit: {
        serialNo: number;
        serialCode: string;
        status: string;
        soldAt: string | null;
        company: {
          name: string;
          phone: string | null;
          logoUrl?: string | null;
          brandPrimary?: string | null;
        };
        product: {
          name: string;
          nameBn: string | null;
          sku: string;
          size: number | null;
          unit: string;
          unitLabel: { en: string; bn: string };
          priceBdt: number;
          description: string | null;
          imageUrl: string | null;
        };
        batch: {
          batchCode: string;
          manufacturedAt: string;
          expiresAt: string | null;
          serialStart: number | null;
          serialEnd: number | null;
        };
      };
    }>(
      `/api/v1/unit/${encodeURIComponent(companySlug)}/${encodeURIComponent(serialCode)}`,
    ),
  publicInvoice: (companySlug: string, invoiceCode: string) =>
    getJson<{ ok: boolean; invoice: SalesInvoice }>(
      `/api/v1/invoice/${encodeURIComponent(companySlug)}/${encodeURIComponent(invoiceCode)}`,
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
