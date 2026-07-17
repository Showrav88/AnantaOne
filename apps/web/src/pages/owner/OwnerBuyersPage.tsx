import { useEffect, useState, useTransition } from "react";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api, type BuyersResponse } from "../../lib/api";

type Props = { locale: LocaleCode };

export function OwnerBuyersPage({ locale }: Props) {
  const t = getMessages(locale);
  const [buyers, setBuyers] = useState<BuyersResponse["buyers"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      void (async () => {
        try {
          const res = await api.owner.buyers();
          setBuyers(res.buyers);
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
          <p className="eyebrow">{t.owner.navBuyers}</p>
          <h1>{t.owner.buyersTitle}</h1>
          <p className="muted">{t.owner.buyersHint}</p>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {pending && buyers.length === 0 ? (
        <p className="muted">{t.common.loading}</p>
      ) : (
        <ul className="buyer-list owner">
          {buyers.map((buyer) => (
            <li key={buyer.id}>
              <div className="buyer-row static">
                <span className="shop">{buyer.shopName}</span>
                <span className="phone">{buyer.phone}</span>
                <span className="addr">{buyer.address ?? "—"}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
