import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { ConfirmActionProvider } from "../../components/ConfirmActionDialog";
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

function isDesktopWidth() {
  return typeof window !== "undefined" && window.innerWidth > 900;
}

const WALLET_PEEK_MS = 5000;

export function OwnerLayout({ locale, onLocale }: Props) {
  const t = getMessages(locale);
  const navigate = useNavigate();
  const location = useLocation();
  const user = getStoredUser();
  const isOwner = user?.role.code === "OWNER";
  const isManager = user?.role.code === "MANAGER";
  const [desktop, setDesktop] = useState(isDesktopWidth);
  /** Desktop: sidebar pinned open by default. Mobile: closed until hamburger. */
  const [menuOpen, setMenuOpen] = useState(isDesktopWidth);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [activeBranch, setActiveBranch] = useState(getActiveBranchId());
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletShown, setWalletShown] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const walletHideTimer = useRef<number | null>(null);
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
      const desk = isDesktopWidth();
      setDesktop((wasDesktop) => {
        if (wasDesktop !== desk) {
          // Only force open/closed when crossing the breakpoint.
          setMenuOpen(desk);
        }
        return desk;
      });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Close drawer after navigation on mobile only (desktop stays pinned).
  useEffect(() => {
    if (!isDesktopWidth()) setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Lock page scroll while mobile drawer is open.
  useEffect(() => {
    if (!menuOpen || desktop) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen, desktop]);

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

  useEffect(() => {
    return () => {
      if (walletHideTimer.current != null) {
        window.clearTimeout(walletHideTimer.current);
      }
    };
  }, []);

  // Refresh cached balance after leaving wallet/payments (debits may have happened).
  useEffect(() => {
    if (!isOwner) return;
    if (
      location.pathname.startsWith("/owner/wallet") ||
      location.pathname.startsWith("/owner/payments") ||
      location.pathname.startsWith("/owner/sell")
    ) {
      setWalletBalance(null);
      setWalletShown(false);
    }
  }, [isOwner, location.pathname]);

  async function loadWalletBalance() {
    setWalletLoading(true);
    try {
      const res = await api.owner.wallet();
      setWalletBalance(res.wallet.balanceBdt);
    } catch {
      setWalletBalance(null);
    } finally {
      setWalletLoading(false);
    }
  }

  function hideWalletBalance() {
    setWalletShown(false);
    if (walletHideTimer.current != null) {
      window.clearTimeout(walletHideTimer.current);
      walletHideTimer.current = null;
    }
  }

  function revealWalletBalance() {
    void loadWalletBalance();
    setWalletShown(true);
    if (walletHideTimer.current != null) {
      window.clearTimeout(walletHideTimer.current);
    }
    walletHideTimer.current = window.setTimeout(() => {
      setWalletShown(false);
      walletHideTimer.current = null;
    }, WALLET_PEEK_MS);
  }

  function toggleWalletPeek() {
    if (walletShown) {
      hideWalletBalance();
      return;
    }
    revealWalletBalance();
  }

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

  const showBackdrop = menuOpen && !desktop;

  return (
    <div
      className={[
        "owner-shell",
        menuOpen ? "nav-open" : "nav-closed",
        desktop ? "is-desktop" : "is-mobile",
      ].join(" ")}
    >
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
        {isOwner ? (
          <button
            type="button"
            className={`wallet-peek${walletShown ? " is-open" : ""}`}
            onClick={toggleWalletPeek}
            aria-pressed={walletShown}
            aria-label={
              walletShown
                ? t.owner.walletPeekHide
                : t.owner.walletPeekShow
            }
            title={
              walletShown
                ? t.owner.walletPeekHide
                : t.owner.walletPeekShow
            }
          >
            <span className="wallet-peek-icon" aria-hidden="true">
              ৳
            </span>
            <span className="wallet-peek-copy">
              <span className="wallet-peek-label">{t.owner.cashBalance}</span>
              <span className="wallet-peek-amount">
                {walletShown
                  ? walletLoading && walletBalance == null
                    ? t.common.loading
                    : walletBalance == null
                      ? "৳—"
                      : `৳${walletBalance.toLocaleString()}`
                  : "৳••••••"}
              </span>
            </span>
          </button>
        ) : null}
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

      {showBackdrop ? (
        <button
          type="button"
          className="nav-backdrop"
          aria-label={t.owner.closeMenu}
          onClick={closeMenu}
        />
      ) : null}

      {/* Desktop: hover left edge to peek the menu when collapsed */}
      {!menuOpen && desktop ? (
        <div className="nav-hotedge" aria-hidden="true" />
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
        <nav onClick={() => { if (!desktop) closeMenu(); }}>
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
          {isOwner || isManager ? (
            <NavLink to="/owner/materials">{t.owner.navMaterials}</NavLink>
          ) : null}
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
            <>
              <NavLink
                to="/owner/wallet"
                className={({ isActive }) => {
                  const tab = new URLSearchParams(location.search).get("tab");
                  const onHome =
                    isActive &&
                    (!tab || tab === "ledger" || tab === "analytics");
                  return [
                    "nav-cash",
                    "nav-cash-wallet",
                    onHome ? "active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                }}
              >
                {t.owner.navWallet}
              </NavLink>
              <NavLink
                to="/owner/wallet?tab=supply"
                className={({ isActive }) => {
                  const tab = new URLSearchParams(location.search).get("tab");
                  return [
                    "nav-cash",
                    "nav-cash-supply",
                    isActive && tab === "supply" ? "active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                }}
              >
                {t.owner.navSupplier}
              </NavLink>
              <NavLink
                to="/owner/wallet?tab=utility"
                className={({ isActive }) => {
                  const tab = new URLSearchParams(location.search).get("tab");
                  return [
                    "nav-cash",
                    "nav-cash-utility",
                    isActive && tab === "utility" ? "active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                }}
              >
                {t.owner.navUtilities}
              </NavLink>
            </>
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
            <NavLink
              to="/pulse"
              onClick={() => {
                if (!desktop) closeMenu();
              }}
            >
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
        <ConfirmActionProvider>
          <Outlet />
        </ConfirmActionProvider>
      </main>
    </div>
  );
}
