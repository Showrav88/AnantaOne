import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { SalesInvoiceView } from "../../components/SalesInvoiceView";
import { api, type SalesInvoice, type SalesOrder } from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Props = { locale: LocaleCode };

export function OwnerSalesHistoryPage({ locale }: Props) {
  const t = getMessages(locale);
  const user = getStoredUser();
  const canReverse =
    user?.role.code === "OWNER" || user?.role.code === "MANAGER";
  const [params] = useSearchParams();
  const focusId = params.get("order");

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scannerRef = useRef<Html5Qrcode | null>(null);

  async function loadList() {
    const res = await api.owner.orders();
    setOrders(res.orders);
    return res.orders;
  }

  async function openById(id: string) {
    const inv = await api.owner.orderInvoice(id);
    setInvoice(inv.invoice);
  }

  async function lookup(q: string) {
    setError(null);
    setOkMsg(null);
    const inv = await api.owner.lookupInvoice(q);
    setInvoice(inv.invoice);
    setQuery(inv.invoice.invoiceCode ?? inv.invoice.invoiceNo ?? q);
  }

  useEffect(() => {
    startTransition(() => {
      void (async () => {
        try {
          const list = await loadList();
          const openId = focusId ?? list[0]?.id;
          if (openId) await openById(openId);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed");
        }
      })();
    });
  }, [focusId]);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, []);

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }

  async function startScanner() {
    setError(null);
    setScanning(true);
    await new Promise((r) => setTimeout(r, 50));
    try {
      const scanner = new Html5Qrcode("invoice-qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 220, height: 220 } },
        (decoded) => {
          void (async () => {
            await stopScanner();
            try {
              await lookup(decoded);
              setOkMsg(t.owner.invoiceFound);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Not found");
            }
          })();
        },
        () => undefined,
      );
    } catch (err) {
      setScanning(false);
      setError(
        err instanceof Error
          ? err.message
          : "Camera unavailable — paste invoice code instead",
      );
    }
  }

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await lookup(query);
      setOkMsg(t.owner.invoiceFound);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Not found");
    }
  }

  async function onReverse(e: FormEvent) {
    e.preventDefault();
    if (!invoice || invoice.isReversed) return;
    setError(null);
    setOkMsg(null);
    try {
      await api.owner.reverseOrder(invoice.id, reason);
      setReason("");
      setOkMsg(t.owner.reverseDone);
      await loadList();
      await openById(invoice.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reverse failed");
    }
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
            <button type="button" className="cta" onClick={() => window.print()}>
              {t.owner.printInvoice}
            </button>
          ) : null}
        </div>
      </header>

      {error ? <p className="error-banner no-print">{error}</p> : null}
      {okMsg ? <p className="ok-banner no-print">{okMsg}</p> : null}

      <section className="invoice-search no-print">
        <form className="owner-form compact" onSubmit={onSearch}>
          <label className="full">
            {t.owner.searchInvoice}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.owner.searchInvoiceHint}
            />
          </label>
          <button type="submit" className="cta">
            {t.owner.findInvoice}
          </button>
          {!scanning ? (
            <button
              type="button"
              className="cta secondary"
              onClick={() => void startScanner()}
            >
              {t.owner.scanInvoiceQr}
            </button>
          ) : (
            <button
              type="button"
              className="cta secondary"
              onClick={() => void stopScanner()}
            >
              {t.owner.stopScan}
            </button>
          )}
        </form>
        <div
          id="invoice-qr-reader"
          className={scanning ? "qr-reader active" : "qr-reader"}
        />
      </section>

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
                    onClick={() =>
                      void openById(o.id).catch((err) =>
                        setError(err instanceof Error ? err.message : "Failed"),
                      )
                    }
                  >
                    <span>
                      {o.buyerName ?? t.owner.walkInBuyer}
                      <div className="muted tiny">
                        {o.invoiceCode ?? o.invoiceNo}
                        {" · "}
                        {o.isReversed || o.status?.code === "REVERSED"
                          ? t.owner.statusReversed
                          : (o.source?.code ?? "")}
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
            <>
              <SalesInvoiceView locale={locale} invoice={invoice} />
              {canReverse && !invoice.isReversed ? (
                <form
                  className="owner-form compact reverse-form no-print"
                  onSubmit={onReverse}
                >
                  <h2>{t.owner.reverseSale}</h2>
                  <p className="muted tiny">{t.owner.reverseHint}</p>
                  <label className="full">
                    {t.owner.reverseReason}
                    <textarea
                      required
                      minLength={5}
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={t.owner.reverseReasonHint}
                    />
                  </label>
                  <button type="submit" className="cta danger">
                    {t.owner.confirmReverse}
                  </button>
                </form>
              ) : null}
            </>
          ) : (
            <p className="muted no-print">{t.owner.selectOrder}</p>
          )}
        </section>
      </div>
    </div>
  );
}
