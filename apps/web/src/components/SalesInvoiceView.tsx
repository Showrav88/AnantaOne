import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { LocaleCode } from "@anantaone/i18n";
import { getMessages } from "@anantaone/i18n";
import type { SalesInvoice } from "../lib/api";

type Props = {
  locale: LocaleCode;
  invoice: SalesInvoice;
};

export function SalesInvoiceView({ locale, invoice }: Props) {
  const t = getMessages(locale);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const value = invoice.qrValue;
    if (!value) {
      setQrDataUrl(null);
      return;
    }
    void QRCode.toDataURL(value, {
      margin: 0,
      width: 72,
      errorCorrectionLevel: "M",
    }).then(setQrDataUrl);
  }, [invoice.qrValue]);

  return (
    <div className="invoice-sheet" id="invoice-print">
      <header className="invoice-head">
        <div className="invoice-brand-block">
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
          <div className="invoice-meta-text">
            <p className="eyebrow">{t.owner.invoiceLabel}</p>
            <p className="invoice-number">
              {invoice.invoiceNo ?? invoice.invoiceCode}
            </p>
            {invoice.isReversed ? (
              <p className="price-override">{t.owner.statusReversed}</p>
            ) : null}
            <p className="muted tiny">
              {new Date(
                invoice.confirmedAt ?? invoice.orderedAt,
              ).toLocaleString()}
            </p>
            <p className="muted tiny">
              {invoice.source
                ? locale === "bn"
                  ? invoice.source.nameBn
                  : invoice.source.nameEn
                : ""}
            </p>
          </div>
          {qrDataUrl ? (
            <figure className="invoice-qr-block">
              <img className="invoice-qr" src={qrDataUrl} alt="Invoice QR" />
              <figcaption className="muted tiny">
                {t.owner.invoiceQrHint}
              </figcaption>
            </figure>
          ) : null}
        </div>
      </header>

      <section className="invoice-party">
        <p className="eyebrow">{t.owner.billTo}</p>
        <p className="invoice-party-name">
          {invoice.buyerName ??
            invoice.buyer?.shopName ??
            t.owner.walkInBuyer}
        </p>
        {invoice.buyer?.phone ? (
          <p className="muted tiny">{invoice.buyer.phone}</p>
        ) : null}
        {invoice.note ? <p className="muted tiny">{invoice.note}</p> : null}
        {invoice.reverseReason ? (
          <p className="price-override">
            {t.owner.reverseReason}: {invoice.reverseReason}
          </p>
        ) : null}
      </section>

      <div className="invoice-table-wrap">
        <table className="invoice-table">
          <thead>
            <tr>
              <th className="col-num">#</th>
              <th>{t.owner.fieldProduct}</th>
              <th>{t.owner.fieldBatch}</th>
              <th className="col-qty">{t.owner.fieldQty}</th>
              <th className="col-money">{t.owner.catalogPrice}</th>
              <th className="col-money">{t.owner.soldPrice}</th>
              <th className="col-money">{t.owner.fieldLineTotal}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, idx) => (
              <tr key={line.id}>
                <td className="col-num">{idx + 1}</td>
                <td>
                  {locale === "bn" && line.product?.nameBn
                    ? line.product.nameBn
                    : (line.product?.name ?? "—")}
                  <div className="muted tiny">{line.product?.sku}</div>
                </td>
                <td>{line.batch?.batchCode ?? "—"}</td>
                <td className="col-qty">{line.qty}</td>
                <td className="col-money">
                  ৳{line.catalogPriceBdt.toLocaleString()}
                </td>
                <td className="col-money">
                  ৳{line.unitPriceBdt.toLocaleString()}
                  {line.priceOverridden ? (
                    <span className="price-override"> *</span>
                  ) : null}
                </td>
                <td className="col-money">
                  ৳{line.lineTotalBdt.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invoice.lines.some((l) => l.priceOverridden) ? (
        <p className="muted tiny invoice-note">
          * {t.owner.priceOverrideNote}
        </p>
      ) : null}

      <footer className="invoice-foot">
        <div className="invoice-total-row">
          <span>{t.owner.invoiceTotal}</span>
          <strong>৳{invoice.totalBdt.toLocaleString()}</strong>
        </div>
        <p className="muted tiny invoice-thanks">{t.owner.invoiceThanks}</p>
      </footer>
    </div>
  );
}
