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
        <Route
          path="/"
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
          path="/owner"
          element={
            <RequireAuth roles={["OWNER", "MANAGER", "EMPLOYEE"]}>
              <OwnerLayout locale={locale} onLocale={toggleLocale} />
            </RequireAuth>
          }
        >
          <Route index element={<OwnerDashboardPage locale={locale} />} />
          <Route path="company" element={<OwnerCompanyPage locale={locale} />} />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
