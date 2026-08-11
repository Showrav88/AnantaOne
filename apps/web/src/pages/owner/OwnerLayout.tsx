import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { ConfirmActionProvider } from "../../components/ConfirmActionDialog";
import { DisplayControls } from "../../components/DisplayControls";
import { api, type BranchRow } from "../../lib/api";
import {
  getActiveBranchId,
  getStoredCompany,
  getStoredUser,
  saveCompany,
  setActiveBranchId,
} from "../../lib/session";

type Props = {
  locale: LocaleCode;
  onLocale: () => void;
};

function isDesktopWidth() {
  return typeof window !== "undefined" && window.innerWidth > 900;
}

type NavTileProps = {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  className?: string | ((args: { isActive: boolean }) => string);
  onNavigate?: () => void;
};

function NavTileLink({
  to,
  label,
  icon,
  end,
  className,
  onNavigate,
}: NavTileProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => {
        const extra =
          typeof className === "function"
            ? className({ isActive })
            : (className ?? "");
        return ["nav-tile", extra, isActive ? "active" : ""]
          .filter(Boolean)
          .join(" ");
      }}
      onClick={onNavigate}
    >
      <span className="nav-tile-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="nav-tile-label">{label}</span>
    </NavLink>
  );
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
  const [shopName, setShopName] = useState(
    () => getStoredCompany()?.name ?? "",
  );
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
    void api.auth
      .me()
      .then((res) => {
        if (res.company?.name) {
          saveCompany(res.company);
          setShopName(res.company.name);
        }
      })
      .catch(() => {});
  }, []);

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
  const brandLabel = shopName || t.app.name;
  const closeNavOnMobile = () => {
    if (!desktop) closeMenu();
  };

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
        <p className="owner-topbar-brand">{brandLabel}</p>
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
        <p className="owner-brand">{brandLabel}</p>
        <p className="owner-role">{roleLabel}</p>
        <p className="muted-nav">{user?.email}</p>
        <nav className="nav-tiles" onClick={closeNavOnMobile}>
          <NavTileLink
            to="/owner"
            end
            icon="📊"
            label={t.owner.navDashboard}
          />
          <NavTileLink to="/owner/sell" icon="🛒" label={t.owner.navSell} />
          <NavTileLink
            to="/owner/history"
            icon="📜"
            label={t.owner.navHistory}
          />
          {isOwner ? (
            <NavTileLink
              to="/owner/batches"
              icon="🏭"
              label={t.owner.navBatches}
            />
          ) : null}
          {isOwner ? (
            <NavTileLink to="/owner/tags" icon="🏷️" label={t.owner.navTags} />
          ) : null}
          <NavTileLink
            to="/owner/products"
            icon="📦"
            label={t.owner.navProducts}
          />
          {isOwner || isManager ? (
            <NavTileLink
              to="/owner/materials"
              icon="🧪"
              label={t.owner.navMaterials}
            />
          ) : null}
          {isOwner ? (
            <NavTileLink
              to="/owner/buyers"
              icon="👥"
              label={t.owner.navBuyers}
            />
          ) : null}
          <NavTileLink
            to="/owner/online-orders"
            icon="🌐"
            label={t.owner.navOnlineOrders}
          />
          {isOwner || isManager ? (
            <NavTileLink
              to="/owner/delivery"
              icon="🚚"
              label={t.owner.navDelivery}
            />
          ) : null}
          {isOwner ? (
            <NavTileLink to="/owner/site" icon="🏪" label={t.owner.navSite} />
          ) : null}
          {isOwner ? (
            <NavTileLink
              to="/owner/company"
              icon="🏢"
              label={t.owner.navCompany}
            />
          ) : null}
          {isOwner || isManager ? (
            <NavTileLink
              to="/owner/branches"
              icon="🏬"
              label={t.owner.navBranches}
            />
          ) : null}
          {isOwner ? (
            <>
              <NavTileLink
                to="/owner/wallet"
                icon="💰"
                label={t.owner.navWallet}
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
              />
              <NavTileLink
                to="/owner/wallet?tab=supply"
                icon="🚛"
                label={t.owner.navSupplier}
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
              />
              <NavTileLink
                to="/owner/wallet?tab=utility"
                icon="⚡"
                label={t.owner.navUtilities}
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
              />
            </>
          ) : null}
          {isOwner ? (
            <NavTileLink
              to="/owner/payments"
              icon="💵"
              label={t.owner.navPayments}
            />
          ) : null}
          {isOwner || isManager ? (
            <NavTileLink to="/owner/staff" icon="👤" label={t.owner.navStaff} />
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
