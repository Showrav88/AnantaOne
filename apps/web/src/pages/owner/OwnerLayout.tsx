import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api } from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Props = {
  locale: LocaleCode;
  onLocale: () => void;
};

export function OwnerLayout({ locale, onLocale }: Props) {
  const t = getMessages(locale);
  const navigate = useNavigate();
  const user = getStoredUser();
  const roleLabel =
    user?.role.code === "MANAGER"
      ? t.owner.roleManager
      : user?.role.code === "EMPLOYEE"
        ? t.owner.roleEmployee
        : t.owner.roleOwner;

  async function logout() {
    await api.auth.logout();
    navigate("/login");
  }

  return (
    <div className="owner-shell">
      <aside className="owner-nav">
        <p className="owner-brand">{t.app.name}</p>
        <p className="owner-role">{roleLabel}</p>
        <p className="muted-nav">{user?.email}</p>
        <nav>
          <NavLink to="/owner" end>
            {t.owner.navDashboard}
          </NavLink>
          <NavLink to="/owner/sell">{t.owner.navSell}</NavLink>
          <NavLink to="/owner/history">{t.owner.navHistory}</NavLink>
          <NavLink to="/owner/batches">{t.owner.navBatches}</NavLink>
          <NavLink to="/owner/tags">{t.owner.navTags}</NavLink>
          <NavLink to="/owner/company">{t.owner.navCompany}</NavLink>
          <NavLink to="/owner/staff">{t.owner.navStaff}</NavLink>
          <NavLink to="/owner/wallet">{t.owner.navWallet}</NavLink>
          <NavLink to="/owner/payments">{t.owner.navPayments}</NavLink>
          <NavLink to="/owner/products">{t.owner.navProducts}</NavLink>
          <NavLink to="/owner/buyers">{t.owner.navBuyers}</NavLink>
        </nav>
        <div className="owner-nav-foot">
          <NavLink to="/pulse">{t.owner.navPublic}</NavLink>
          <button type="button" className="lang" onClick={onLocale}>
            {t.common.language}
          </button>
          <button type="button" className="lang" onClick={() => void logout()}>
            {t.auth.logout}
          </button>
        </div>
      </aside>
      <main className="owner-main">
        <Outlet />
      </main>
    </div>
  );
}
