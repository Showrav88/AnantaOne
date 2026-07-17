import { NavLink, Outlet } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";

type Props = {
  locale: LocaleCode;
  onLocale: () => void;
};

export function OwnerLayout({ locale, onLocale }: Props) {
  const t = getMessages(locale);

  return (
    <div className="owner-shell">
      <aside className="owner-nav">
        <p className="owner-brand">{t.app.name}</p>
        <p className="owner-role">{t.owner.roleOwner}</p>
        <nav>
          <NavLink to="/owner" end>
            {t.owner.navDashboard}
          </NavLink>
          <NavLink to="/owner/company">{t.owner.navCompany}</NavLink>
          <NavLink to="/owner/products">{t.owner.navProducts}</NavLink>
          <NavLink to="/owner/buyers">{t.owner.navBuyers}</NavLink>
        </nav>
        <div className="owner-nav-foot">
          <NavLink to="/">{t.owner.navPublic}</NavLink>
          <button type="button" className="lang dark" onClick={onLocale}>
            {t.common.language}
          </button>
        </div>
      </aside>
      <main className="owner-main">
        <Outlet />
      </main>
    </div>
  );
}
