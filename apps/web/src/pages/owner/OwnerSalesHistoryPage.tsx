import { useEffect, useState, useTransition } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { SalesInvoiceView } from "../../components/SalesInvoiceView";
import { api, type SalesInvoice, type SalesOrder } from "../../lib/api";

type Props = { locale: LocaleCode };

export function OwnerSalesHistoryPage({ locale }: Props) {
  const t = getMessages(locale);
  const [params] = useSearchParams();
  const focusId = params.get("order");

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load() {
    const res = await api.owner.orders();
    setOrders(res.orders);
    const openId = focusId ?? res.orders[0]?.id;
    if (openId) {
      const inv = await api.owner.orderInvoice(openId);
      setInvoice(inv.invoice);
    }
  }

  useEffect(() => {
    startTransition(() => {
      void load().catch((err) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
    });
  }, [focusId]);

  async function openInvoice(id: string) {
    setError(null);
    try {
      const inv = await api.owner.orderInvoice(id);
      setInvoice(inv.invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  function printInvoice() {
    window.print();
  }

  return (
    <div className="owner-page">
      <header className="owner-header no-print">
        <div>
          <p className="eyebrow">{t.owner.navHistory}</p>
          <h1>{t.owner.historyTitle}</h1>
          <p className="muted">{t.owner.historyHint}</p>
        </div>
        <div className="header-links">
          <Link to="/owner/sell">{t.owner.navSell}</Link>
          {invoice ? (
            <button type="button" className="cta" onClick={printInvoice}>
              {t.owner.printInvoice}
            </button>
          ) : null}
        </div>
      </header>

      {error ? <p className="error-banner no-print">{error}</p> : null}

      <div className="history-layout">
        <aside className="history-list no-print">
          <h2>{t.owner.recentOrders}</h2>
          {pending && orders.length === 0 ? (
            <p className="muted">{t.common.loading}</p>
          ) : null}
          <ul className="plain-list">
            {orders.length === 0 ? (
              <li className="muted">{t.owner.ordersEmpty}</li>
            ) : (
              orders.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    className={`history-item ${invoice?.id === o.id ? "active" : ""}`}
                    onClick={() => void openInvoice(o.id)}
                  >
                    <span>
                      {o.buyerName ?? t.owner.walkInBuyer}
                      <div className="muted tiny">
                        {new Date(o.confirmedAt ?? o.orderedAt).toLocaleString()}
                        {" · "}
                        {o.source?.code}
                      </div>
                    </span>
                    <span>৳{o.totalBdt.toLocaleString()}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <section className="history-invoice">
          {invoice ? (
            <SalesInvoiceView locale={locale} invoice={invoice} />
          ) : (
            <p className="muted no-print">{t.owner.selectOrder}</p>
          )}
        </section>
      </div>
    </div>
  );
}
