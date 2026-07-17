import { useEffect, useState, useTransition } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { DisplayControls } from "../../components/DisplayControls";
import { api } from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Props = {
  locale: LocaleCode;
  onLocale: () => void;
};

export function AdminLayout({ locale, onLocale }: Props) {
  const t = getMessages(locale);
  const navigate = useNavigate();
  const user = getStoredUser();

  async function logout() {
    await api.auth.logout();
    navigate("/login");
  }

  return (
    <div className="owner-shell admin">
      <header className="owner-topbar">
        <p className="owner-topbar-brand">{t.app.name}</p>
        <DisplayControls locale={locale} compact />
        <button type="button" className="lang compact" onClick={onLocale}>
          {t.common.language}
        </button>
      </header>
      <aside className="owner-nav">
        <p className="owner-brand">{t.app.name}</p>
        <p className="owner-role">{t.admin.roleLabel}</p>
        <p className="muted-nav">{user?.email}</p>
        <nav>
          <NavLink to="/admin" end>
            {t.admin.navDashboard}
          </NavLink>
          <NavLink to="/admin/companies">{t.admin.navCompanies}</NavLink>
        </nav>
        <div className="owner-nav-foot">
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

export function AdminDashboardPage({ locale }: { locale: LocaleCode }) {
  const t = getMessages(locale);
  const [stats, setStats] = useState({
    companies: 0,
    users: 0,
    buyers: 0,
    products: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      void (async () => {
        try {
          const res = await api.admin.dashboard();
          setStats(res.dashboard.stats);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed");
        }
      })();
    });
  }, []);

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.admin.navDashboard}</p>
          <h1>{t.admin.title}</h1>
          <p className="muted">{t.admin.hint}</p>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      {pending ? <p className="muted">{t.common.loading}</p> : null}
      <section className="stat-grid">
        <article>
          <p>{t.admin.statCompanies}</p>
          <strong>{stats.companies}</strong>
        </article>
        <article>
          <p>{t.admin.statUsers}</p>
          <strong>{stats.users}</strong>
        </article>
        <article>
          <p>{t.admin.statBuyers}</p>
          <strong>{stats.buyers}</strong>
        </article>
        <article>
          <p>{t.admin.statProducts}</p>
          <strong>{stats.products}</strong>
        </article>
      </section>
    </div>
  );
}

export function AdminCompaniesPage({ locale }: { locale: LocaleCode }) {
  const t = getMessages(locale);
  const [rows, setRows] = useState<
    Array<{
      id: string;
      name: string;
      slug: string;
      isActive: boolean;
      counts: { users: number; buyers: number; products: number };
      owner: { name: string; email: string } | null;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await api.admin.companies();
    setRows(res.companies);
  }

  useEffect(() => {
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed"),
    );
  }, []);

  async function toggle(id: string, isActive: boolean) {
    setError(null);
    try {
      await api.admin.setCompanyActive(id, isActive);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.admin.navCompanies}</p>
          <h1>{t.admin.companiesTitle}</h1>
          <p className="muted">{t.admin.companiesHint}</p>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.owner.fieldName}</th>
              <th>{t.auth.ownerName}</th>
              <th>{t.owner.statProducts}</th>
              <th>{t.owner.statBuyers}</th>
              <th>{t.owner.fieldStatus}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className={c.isActive ? "" : "dim"}>
                <td>
                  {c.name}
                  <div className="muted">{c.slug}</div>
                </td>
                <td>
                  {c.owner?.name ?? "—"}
                  <div className="muted">{c.owner?.email}</div>
                </td>
                <td>{c.counts.products}</td>
                <td>{c.counts.buyers}</td>
                <td>{c.isActive ? t.common.online : t.common.offline}</td>
                <td>
                  <button
                    type="button"
                    className="btn ghost compact dark"
                    onClick={() => void toggle(c.id, !c.isActive)}
                  >
                    {c.isActive ? t.admin.disable : t.admin.enable}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
