import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { DisplayControls } from "../../components/DisplayControls";
import { api, type BranchRow } from "../../lib/api";
import {
  getActiveBranchId,
  getStoredUser,
  setActiveBranchId,
} from "../../lib/session";

type Props = {
  locale: LocaleCode;
  onLocale: () => void;
};

export function OwnerLayout({ locale, onLocale }: Props) {
  const t = getMessages(locale);
  const navigate = useNavigate();
  const location = useLocation();
  const user = getStoredUser();
  const isOwner = user?.role.code === "OWNER";
  const isManager = user?.role.code === "MANAGER";
  const [menuOpen, setMenuOpen] = useState(false);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [activeBranch, setActiveBranch] = useState(getActiveBranchId());
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

  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 900) setMenuOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Close drawer after navigation (mobile).
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Escape closes open menu.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Lock page scroll while drawer is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useEffect(() => {
    void api.owner
      .branches()
      .then((res) => setBranches(res.branches.filter((b) => b.isActive)))
      .catch(() => setBranches([]));
  }, []);

  useEffect(() => {
    function onBranchChange() {
      setActiveBranch(getActiveBranchId());
    }
    window.addEventListener("anantaone:branch-change", onBranchChange);
    return () =>
      window.removeEventListener("anantaone:branch-change", onBranchChange);
  }, []);

  function closeMenu() {
    setMenuOpen(false);
  }

  function toggleMenu() {
    setMenuOpen((v) => !v);
  }

  function onSwitchBranch(value: string) {
    setActiveBranchId(value);
    setActiveBranch(value);
  }

  const lockedBranchName =
    user?.branch?.name ??
    branches.find((b) => b.id === user?.branchId)?.name ??
    t.owner.noBranch;

  return (
    <div className={`owner-shell ${menuOpen ? "nav-open" : ""}`}>
      <header className="owner-topbar">
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? t.owner.closeMenu : t.owner.openMenu}
          onClick={toggleMenu}
        >
          <span />
          <span />
          <span />
        </button>
        <p className="owner-topbar-brand">{t.app.name}</p>
        <div className="branch-switcher topbar-branch">
          {isOwner ? (
            <label>
              <span className="sr-only">{t.owner.activeBranch}</span>
              <select
                value={activeBranch}
                onChange={(e) => onSwitchBranch(e.target.value)}
                aria-label={t.owner.activeBranch}
              >
                <option value="all">{t.owner.allBranches}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="branch-locked" title={t.owner.branchLockedHint}>
              {lockedBranchName}
            </p>
          )}
        </div>
        <DisplayControls locale={locale} compact />
        <button type="button" className="lang compact" onClick={onLocale}>
          {t.common.language}
        </button>
      </header>

      {menuOpen ? (
        <button
          type="button"
          className="nav-backdrop"
          aria-label={t.owner.closeMenu}
          onClick={closeMenu}
        />
      ) : null}

      <aside className="owner-nav">
        <p className="owner-brand">{t.app.name}</p>
        <p className="owner-role">{roleLabel}</p>
        <p className="muted-nav">{user?.email}</p>
        <div className="branch-switcher nav-branch">
          <p className="muted tiny">{t.owner.activeBranch}</p>
          {isOwner ? (
            <select
              value={activeBranch}
              onChange={(e) => onSwitchBranch(e.target.value)}
            >
              <option value="all">{t.owner.allBranches}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="branch-locked">{lockedBranchName}</p>
          )}
        </div>
        <nav onClick={closeMenu}>
          <NavLink to="/owner" end>
            {t.owner.navDashboard}
          </NavLink>
          <NavLink to="/owner/sell">{t.owner.navSell}</NavLink>
          <NavLink to="/owner/history">{t.owner.navHistory}</NavLink>
          {isOwner ? (
            <NavLink to="/owner/batches">{t.owner.navBatches}</NavLink>
          ) : null}
          {isOwner ? (
            <NavLink to="/owner/tags">{t.owner.navTags}</NavLink>
          ) : null}
          <NavLink to="/owner/products">{t.owner.navProducts}</NavLink>
          {isOwner ? (
            <NavLink to="/owner/buyers">{t.owner.navBuyers}</NavLink>
          ) : null}
          <NavLink to="/owner/online-orders">{t.owner.navOnlineOrders}</NavLink>
          {isOwner || isManager ? (
            <NavLink to="/owner/delivery">{t.owner.navDelivery}</NavLink>
          ) : null}
          {isOwner ? (
            <NavLink to="/owner/site">{t.owner.navSite}</NavLink>
          ) : null}
          {isOwner ? (
            <NavLink to="/owner/company">{t.owner.navCompany}</NavLink>
          ) : null}
          {isOwner || isManager ? (
            <NavLink to="/owner/branches">{t.owner.navBranches}</NavLink>
          ) : null}
          {isOwner ? (
            <NavLink to="/owner/wallet">{t.owner.navWallet}</NavLink>
          ) : null}
          {isOwner ? (
            <NavLink to="/owner/payments">{t.owner.navPayments}</NavLink>
          ) : null}
          {isOwner || isManager ? (
            <NavLink to="/owner/staff">{t.owner.navStaff}</NavLink>
          ) : null}
        </nav>
        <div className="owner-nav-foot">
          {isOwner ? (
            <NavLink to="/pulse" onClick={closeMenu}>
              {t.owner.navPublic}
            </NavLink>
          ) : null}
          <DisplayControls locale={locale} />
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
