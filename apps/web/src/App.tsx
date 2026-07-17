import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { LocaleCode } from "@anantaone/i18n";
import { HomePulsePage } from "./pages/HomePulsePage";
import { OwnerLayout } from "./pages/owner/OwnerLayout";
import { OwnerDashboardPage } from "./pages/owner/OwnerDashboardPage";
import { OwnerCompanyPage } from "./pages/owner/OwnerCompanyPage";
import { OwnerProductsPage } from "./pages/owner/OwnerProductsPage";
import { OwnerBuyersPage } from "./pages/owner/OwnerBuyersPage";

export function App() {
  const [locale, setLocale] = useState<LocaleCode>("bn");

  function toggleLocale() {
    setLocale((prev) => (prev === "bn" ? "en" : "bn"));
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<HomePulsePage locale={locale} onLocale={toggleLocale} />}
        />
        <Route
          path="/owner"
          element={<OwnerLayout locale={locale} onLocale={toggleLocale} />}
        >
          <Route index element={<OwnerDashboardPage locale={locale} />} />
          <Route path="company" element={<OwnerCompanyPage locale={locale} />} />
          <Route path="products" element={<OwnerProductsPage locale={locale} />} />
          <Route path="buyers" element={<OwnerBuyersPage locale={locale} />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
