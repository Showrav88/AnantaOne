import type { LocaleCode } from "@anantaone/i18n";
import { getMessages } from "@anantaone/i18n";
import type { SalesInvoice } from "../lib/api";

type Props = {
  locale: LocaleCode;
  invoice: SalesInvoice;
};

export function SalesInvoiceView({ locale, invoice }: Props) {
  const t = getMessages(locale);

  return (
    <div className="invoice-sheet" id="invoice-print">
      <header className="invoice-head">
        <div>
          <p className="invoice-brand">{invoice.company.name}</p>
          {invoice.company.tagline ? (
            <p className="muted tiny">{invoice.company.tagline}</p>
          ) : null}
          {invoice.company.phone ? (
            <p className="muted tiny">{invoice.company.phone}</p>
          ) : null}
          {invoice.company.address ? (
            <p className="muted tiny">{invoice.company.address}</p>
          ) : null}
        </div>
        <div className="invoice-meta">
          <p className="eyebrow">{t.owner.invoiceLabel}</p>
          <strong>{invoice.invoiceNo}</strong>
          <p className="muted tiny">
            {new Date(invoice.confirmedAt ?? invoice.orderedAt).toLocaleString()}
          </p>
          <p className="muted tiny">
            {invoice.source
              ? locale === "bn"
                ? invoice.source.nameBn
                : invoice.source.nameEn
              : ""}
          </p>
        </div>
      </header>

      <section className="invoice-party">
        <p className="eyebrow">{t.owner.billTo}</p>
        <p>
          <strong>
            {invoice.buyerName ??
              invoice.buyer?.shopName ??
              t.owner.walkInBuyer}
          </strong>
        </p>
        {invoice.buyer?.phone ? (
          <p className="muted tiny">{invoice.buyer.phone}</p>
        ) : null}
        {invoice.note ? <p className="muted tiny">{invoice.note}</p> : null}
      </section>

      <table className="invoice-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t.owner.fieldProduct}</th>
            <th>{t.owner.fieldBatch}</th>
            <th>{t.owner.fieldQty}</th>
            <th>{t.owner.catalogPrice}</th>
            <th>{t.owner.soldPrice}</th>
            <th>{t.owner.fieldLineTotal}</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line, idx) => (
            <tr key={line.id}>
              <td>{idx + 1}</td>
              <td>
                {locale === "bn" && line.product?.nameBn
                  ? line.product.nameBn
                  : (line.product?.name ?? "—")}
                <div className="muted tiny">{line.product?.sku}</div>
              </td>
              <td>{line.batch?.batchCode ?? "—"}</td>
              <td>{line.qty}</td>
              <td>৳{line.catalogPriceBdt.toLocaleString()}</td>
              <td>
                ৳{line.unitPriceBdt.toLocaleString()}
                {line.priceOverridden ? (
                  <span className="price-override"> *</span>
                ) : null}
              </td>
              <td>৳{line.lineTotalBdt.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {invoice.lines.some((l) => l.priceOverridden) ? (
        <p className="muted tiny invoice-note">
          * {t.owner.priceOverrideNote}
        </p>
      ) : null}

      <footer className="invoice-foot">
        <p className="invoice-total">
          {t.owner.invoiceTotal}: ৳{invoice.totalBdt.toLocaleString()}
        </p>
        <p className="muted tiny">{t.owner.invoiceThanks}</p>
      </footer>
    </div>
  );
}
