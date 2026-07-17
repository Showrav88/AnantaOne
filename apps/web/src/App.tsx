import { useEffect, useState, useTransition } from "react";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api, type BuyersResponse, type OverviewResponse } from "./lib/api";

type LinkState = "loading" | "up" | "down";

export function App() {
  const [locale, setLocale] = useState<LocaleCode>("bn");
  const [apiState, setApiState] = useState<LinkState>("loading");
  const [dbState, setDbState] = useState<LinkState>("loading");
  const [overview, setOverview] = useState<OverviewResponse["company"]>();
  const [buyers, setBuyers] = useState<BuyersResponse["buyers"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showLive, setShowLive] = useState(false);
  const [pending, startTransition] = useTransition();
  const t = getMessages(locale);

  async function refresh() {
    setError(null);
    try {
      const health = await api.health();
      setApiState(health.ok ? "up" : "down");
    } catch {
      setApiState("down");
      setDbState("down");
      setOverview(undefined);
      setBuyers([]);
      setError(t.home.notConnected);
      return;
    }

    try {
      const db = await api.healthDb();
      setDbState(db.ok ? "up" : "down");
    } catch {
      setDbState("down");
    }

    try {
      const [ov, by] = await Promise.all([api.overview(), api.buyers()]);
      setOverview(ov.company);
      setBuyers(by.buyers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "API error");
    }
  }

  useEffect(() => {
    startTransition(() => {
      void refresh();
    });
    // initial link check only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connected = apiState === "up" && dbState === "up";

  function openLive() {
    setShowLive(true);
    startTransition(() => {
      void refresh();
    });
    requestAnimationFrame(() => {
      document.getElementById("live")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  return (
    <div className="page">
      <div className="atmosphere" aria-hidden="true" />

      <header className="topbar">
        <span className="topbar-brand">{t.app.name}</span>
        <button
          type="button"
          className="lang"
          onClick={() => setLocale(locale === "bn" ? "en" : "bn")}
        >
          {t.common.language}
        </button>
      </header>

      <section className="hero">
        <p className="brand">{t.app.name}</p>
        <h1>{t.app.tagline}</h1>
        <p className="lede">{t.app.pulse}</p>
        <div className="cta-row">
          <button type="button" className="btn primary" onClick={openLive}>
            {t.home.ctaPrimary}
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() =>
              startTransition(() => {
                void refresh();
              })
            }
            disabled={pending}
          >
            {t.home.ctaSecondary}
          </button>
        </div>
        <p className="hero-status" aria-live="polite">
          {connected ? t.home.connected : apiState === "loading" ? t.common.loading : t.home.notConnected}
        </p>
      </section>

      {showLive ? (
        <section id="live" className="live">
          <div className="live-head">
            <h2>{connected ? t.home.connected : t.home.notConnected}</h2>
            <button
              type="button"
              className="btn ghost compact"
              onClick={() =>
                startTransition(() => {
                  void refresh();
                })
              }
            >
              {t.common.retry}
            </button>
          </div>

          <ul className="pulse-strip" aria-label="connection">
            <li>
              <span className="label">{t.home.apiLabel}</span>
              <span className={`dot ${apiState}`} />
              <strong>
                {apiState === "loading"
                  ? t.common.loading
                  : apiState === "up"
                    ? t.common.online
                    : t.common.offline}
              </strong>
            </li>
            <li>
              <span className="label">{t.home.dbLabel}</span>
              <span className={`dot ${dbState}`} />
              <strong>
                {dbState === "loading"
                  ? t.common.loading
                  : dbState === "up"
                    ? t.common.online
                    : t.common.offline}
              </strong>
            </li>
          </ul>

          {error ? <p className="error">{error}</p> : null}

          {overview ? (
            <div className="overview">
              <p className="eyebrow">{t.home.companyLabel}</p>
              <p className="company-name">{overview.name}</p>
              <p className="meta">
                {overview.branches[0]?.name ?? "—"}
                {overview.branches[0]?.address ? ` · ${overview.branches[0].address}` : ""}
              </p>
              <dl className="stats">
                <div>
                  <dt>{t.home.buyersLabel}</dt>
                  <dd>{overview.counts.buyers}</dd>
                </div>
                <div>
                  <dt>{t.home.branchesLabel}</dt>
                  <dd>{overview.branches.length}</dd>
                </div>
              </dl>
            </div>
          ) : null}

          <div className="buyers">
            <h3>{t.nav.buyers}</h3>
            {buyers.length === 0 ? (
              <p className="empty">{t.home.emptyBuyers}</p>
            ) : (
              <ul className="buyer-list">
                {buyers.map((buyer) => (
                  <li key={buyer.id}>
                    <button type="button" className="buyer-row">
                      <span className="shop">{buyer.shopName}</span>
                      <span className="phone">{buyer.phone}</span>
                      <span className="addr">{buyer.address ?? "—"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
