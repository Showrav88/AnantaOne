import { useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import type { LocaleCode } from "@anantaone/i18n";
import { RequireAuth } from "./components/RequireAuth";
import { HomePulsePage } from "./pages/HomePulsePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { OwnerLayout } from "./pages/owner/OwnerLayout";
import { OwnerDashboardPage } from "./pages/owner/OwnerDashboardPage";
import { OwnerCompanyPage } from "./pages/owner/OwnerCompanyPage";
import { OwnerProductsPage } from "./pages/owner/OwnerProductsPage";
import { OwnerBuyersPage } from "./pages/owner/OwnerBuyersPage";
import { OwnerStaffPage } from "./pages/owner/OwnerStaffPage";
import { OwnerWalletPage } from "./pages/owner/OwnerWalletPage";
import { OwnerPaymentsPage } from "./pages/owner/OwnerPaymentsPage";
import { OwnerSellPage } from "./pages/owner/OwnerSellPage";
import { OwnerBatchesPage } from "./pages/owner/OwnerBatchesPage";
import { OwnerTagsPage } from "./pages/owner/OwnerTagsPage";
import { OwnerSalesHistoryPage } from "./pages/owner/OwnerSalesHistoryPage";
import { OwnerSitePage } from "./pages/owner/OwnerSitePage";
import { PublicTagPage } from "./pages/PublicTagPage";
import { PublicInvoicePage } from "./pages/PublicInvoicePage";
import { PublicShopPage } from "./pages/PublicShopPage";
import {
  AdminCompaniesPage,
  AdminDashboardPage,
  AdminLayout,
} from "./pages/admin/AdminPages";

export function App() {
  const [locale, setLocale] = useState<LocaleCode>("bn");

  function toggleLocale() {
    setLocale((prev) => (prev === "bn" ? "en" : "bn"));
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="/pulse"
          element={<HomePulsePage locale={locale} onLocale={toggleLocale} />}
        />
        <Route
          path="/login"
          element={<LoginPage locale={locale} onLocale={toggleLocale} />}
        />
        <Route
          path="/register"
          element={<RegisterPage locale={locale} onLocale={toggleLocale} />}
        />
        <Route
          path="/tag/:companySlug/:sku/:batchCode"
          element={<PublicTagPage locale={locale} onLocale={toggleLocale} />}
        />
        <Route
          path="/invoice/:companySlug/:invoiceCode"
          element={<PublicInvoicePage locale={locale} onLocale={toggleLocale} />}
        />
        <Route
          path="/shop/:companySlug"
          element={<PublicShopPage locale={locale} onLocale={toggleLocale} />}
        />
        <Route
          path="/owner"
          element={
            <RequireAuth roles={["OWNER", "MANAGER", "EMPLOYEE"]}>
              <OwnerLayout locale={locale} onLocale={toggleLocale} />
            </RequireAuth>
          }
        >
          <Route index element={<OwnerDashboardPage locale={locale} />} />
          <Route path="company" element={<OwnerCompanyPage locale={locale} />} />
          <Route path="site" element={<OwnerSitePage locale={locale} />} />
          <Route path="sell" element={<OwnerSellPage locale={locale} />} />
          <Route
            path="history"
            element={<OwnerSalesHistoryPage locale={locale} />}
          />
          <Route path="batches" element={<OwnerBatchesPage locale={locale} />} />
          <Route path="tags" element={<OwnerTagsPage locale={locale} />} />
          <Route path="staff" element={<OwnerStaffPage locale={locale} />} />
          <Route path="wallet" element={<OwnerWalletPage locale={locale} />} />
          <Route path="payments" element={<OwnerPaymentsPage locale={locale} />} />
          <Route path="products" element={<OwnerProductsPage locale={locale} />} />
          <Route path="buyers" element={<OwnerBuyersPage locale={locale} />} />
        </Route>
        <Route
          path="/admin"
          element={
            <RequireAuth roles={["SUPER_ADMIN"]}>
              <AdminLayout locale={locale} onLocale={toggleLocale} />
            </RequireAuth>
          }
        >
          <Route index element={<AdminDashboardPage locale={locale} />} />
          <Route
            path="companies"
            element={<AdminCompaniesPage locale={locale} />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </HashRouter>
  );
}
