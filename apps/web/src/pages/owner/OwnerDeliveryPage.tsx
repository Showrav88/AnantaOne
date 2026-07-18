import { useEffect, useState, useTransition, type FormEvent } from "react";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api } from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Props = { locale: LocaleCode };

export function OwnerDeliveryPage({ locale }: Props) {
  const t = getMessages(locale);
  const user = getStoredUser();
  const canWrite = user?.role.code === "OWNER" || user?.role.code === "MANAGER";
  const [branches, setBranches] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [branchId, setBranchId] = useState("");
  const [wards, setWards] = useState<
    Array<{
      id: string;
      name: string;
      nameBn: string | null;
      freeDelivery: boolean;
      baseChargeBdt: number;
      isActive: boolean;
      branchId: string | null;
    }>
  >([]);
  const [rates, setRates] = useState<
    Array<{
      id: string;
      category: string;
      chargePerUnitBdt: number;
      note: string | null;
    }>
  >([]);
  const [coupons, setCoupons] = useState<
    Array<{
      id: string;
      code: string;
      discountType: string;
      discountValue: number;
      usedCount: number;
      isActive: boolean;
    }>
  >([]);
  const [rateForm, setRateForm] = useState({
    category: "DRINKING",
    chargePerUnitBdt: "5",
    note: "",
  });
  const [couponForm, setCouponForm] = useState({
    code: "",
    discountType: "PERCENT",
    discountValue: "10",
    minOrderBdt: "",
  });
  const [locationLabel, setLocationLabel] = useState("");
  const [settings, setSettings] = useState({
    outsideAreaChargeBdt: "80",
    sameDistrictChargeBdt: "120",
    otherDistrictChargeBdt: "250",
    defaultWardCount: "15",
    freeWardCount: "5",
  });
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function load(selectedBranch?: string) {
    const branchFilter = selectedBranch ?? branchId;
    const [company, w, r, c, s] = await Promise.all([
      api.owner.company(),
      api.owner.deliveryWards(branchFilter || undefined),
      api.owner.deliveryRates(),
      api.owner.coupons(),
      api.owner.deliverySettings(),
    ]);
    setBranches(company.company.branches.map((b) => ({ id: b.id, name: b.name })));
    setWards(w.wards);
    setRates(r.rates);
    setCoupons(c.coupons);
    setSettings({
      outsideAreaChargeBdt: String(s.settings.outsideAreaChargeBdt),
      sameDistrictChargeBdt: String(s.settings.sameDistrictChargeBdt),
      otherDistrictChargeBdt: String(s.settings.otherDistrictChargeBdt),
      defaultWardCount: String(s.settings.defaultWardCount),
      freeWardCount: String(s.settings.freeWardCount),
    });
    const co = company.company;
    const parts = [
      locale === "bn" && co.upazila?.nameBn
        ? co.upazila.nameBn
        : co.upazila?.name,
      locale === "bn" && co.district?.nameBn
        ? co.district.nameBn
        : co.district?.name,
      locale === "bn" && co.division?.nameBn
        ? co.division.nameBn
        : co.division?.name,
    ].filter(Boolean);
    setLocationLabel(parts.join(" · ") || t.owner.setCompanyLocationFirst);
  }

  useEffect(() => {
    startTransition(() => {
      void load().catch((err) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function seedWards() {
    setError(null);
    try {
      await api.owner.seedDeliveryArea({
        branchId: branchId || null,
        wardCount: Number(settings.defaultWardCount) || 15,
        freeWardCount: Number(settings.freeWardCount) || 5,
      });
      setOkMsg(t.owner.wardsSeeded);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seed failed");
    }
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.owner.updateDeliverySettings({
        outsideAreaChargeBdt: Number(settings.outsideAreaChargeBdt),
        sameDistrictChargeBdt: Number(settings.sameDistrictChargeBdt),
        otherDistrictChargeBdt: Number(settings.otherDistrictChargeBdt),
        defaultWardCount: Number(settings.defaultWardCount),
        freeWardCount: Number(settings.freeWardCount),
      });
      setOkMsg(t.owner.saved);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function toggleFree(id: string, freeDelivery: boolean) {
    try {
      await api.owner.updateDeliveryWard(id, { freeDelivery });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function saveBaseCharge(id: string, baseChargeBdt: number) {
    try {
      await api.owner.updateDeliveryWard(id, { baseChargeBdt });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function saveRate(e: FormEvent) {
    e.preventDefault();
    try {
      await api.owner.upsertDeliveryRate({
        category: rateForm.category,
        chargePerUnitBdt: Number(rateForm.chargePerUnitBdt),
        note: rateForm.note || null,
      });
      setOkMsg(t.owner.saved);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function saveCoupon(e: FormEvent) {
    e.preventDefault();
    try {
      await api.owner.createCoupon({
        code: couponForm.code,
        discountType: couponForm.discountType,
        discountValue: Number(couponForm.discountValue),
        minOrderBdt: couponForm.minOrderBdt
          ? Number(couponForm.minOrderBdt)
          : null,
      });
      setCouponForm({
        code: "",
        discountType: "PERCENT",
        discountValue: "10",
        minOrderBdt: "",
      });
      setOkMsg(t.owner.saved);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  function categoryLabel(code: string) {
    if (code === "DRINKING") return t.owner.catDrinking;
    if (code === "DISTILLED") return t.owner.catDistilled;
    if (code === "BATTERY") return t.owner.catBattery;
    if (code === "OTHER") return t.owner.catOther;
    return code;
  }

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.owner.navDelivery}</p>
          <h1>{t.owner.deliveryTitle}</h1>
          <p className="muted">{t.owner.deliveryHint}</p>
        </div>
        {canWrite ? (
          <button type="button" className="btn primary" onClick={() => void seedWards()}>
            {t.owner.seedWards}
          </button>
        ) : null}
      </header>

      {okMsg ? <p className="ok">{okMsg}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {pending && wards.length === 0 ? (
        <p className="muted">{t.common.loading}</p>
      ) : null}

      <section className="panel-card">
        <h2>{t.owner.deliveryZoneCharges}</h2>
        <p className="muted tiny">{t.owner.deliveryZoneHint}</p>
        <p className="muted tiny">
          {t.owner.fieldUpazila}: {locationLabel}
        </p>
        {canWrite ? (
          <form className="owner-form compact" onSubmit={saveSettings}>
            <label>
              {t.owner.outsideAreaCharge}
              <input
                type="number"
                min={0}
                value={settings.outsideAreaChargeBdt}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    outsideAreaChargeBdt: e.target.value,
                  })
                }
              />
            </label>
            <label>
              {t.owner.sameDistrictCharge}
              <input
                type="number"
                min={0}
                value={settings.sameDistrictChargeBdt}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    sameDistrictChargeBdt: e.target.value,
                  })
                }
              />
            </label>
            <label>
              {t.owner.otherDistrictCharge}
              <input
                type="number"
                min={0}
                value={settings.otherDistrictChargeBdt}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    otherDistrictChargeBdt: e.target.value,
                  })
                }
              />
            </label>
            <label>
              {t.owner.wardCount}
              <input
                type="number"
                min={1}
                max={50}
                value={settings.defaultWardCount}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultWardCount: e.target.value,
                  })
                }
              />
            </label>
            <button className="btn primary" type="submit">
              {t.common.save}
            </button>
          </form>
        ) : null}
      </section>

      <section className="panel-card">
        <h2>{t.owner.wardsTitle}</h2>
        <p className="muted tiny">{t.owner.wardsHint}</p>
        {branches.length > 0 ? (
          <label className="inline-field">
            {t.owner.fieldBranch}
            <select
              value={branchId}
              onChange={(e) => {
                const next = e.target.value;
                setBranchId(next);
                void load(next).catch((err) =>
                  setError(err instanceof Error ? err.message : "Failed"),
                );
              }}
            >
              <option value="">{t.owner.allBranches}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.owner.fieldWard}</th>
                <th>{t.shop.freeDelivery}</th>
                <th>{t.owner.baseDeliveryCharge}</th>
              </tr>
            </thead>
            <tbody>
              {wards.map((w) => (
                <tr key={w.id}>
                  <td data-label={t.owner.fieldWard}>
                    {locale === "bn" && w.nameBn ? w.nameBn : w.name}
                  </td>
                  <td data-label={t.shop.freeDelivery}>
                    {canWrite ? (
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={w.freeDelivery}
                          onChange={(e) =>
                            void toggleFree(w.id, e.target.checked)
                          }
                        />
                        <span>
                          {w.freeDelivery ? t.shop.freeDelivery : "—"}
                        </span>
                      </label>
                    ) : w.freeDelivery ? (
                      t.shop.freeDelivery
                    ) : (
                      "—"
                    )}
                  </td>
                  <td data-label={t.owner.baseDeliveryCharge}>
                    {canWrite && !w.freeDelivery ? (
                      <input
                        className="inline-number"
                        type="number"
                        min={0}
                        step="1"
                        defaultValue={w.baseChargeBdt}
                        key={`${w.id}-${w.baseChargeBdt}`}
                        onBlur={(e) => {
                          const next = Number(e.target.value);
                          if (
                            Number.isFinite(next) &&
                            next !== w.baseChargeBdt
                          ) {
                            void saveBaseCharge(w.id, next);
                          }
                        }}
                      />
                    ) : (
                      <>৳{w.baseChargeBdt}</>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel-card">
        <h2>{t.owner.categoryRatesTitle}</h2>
        <p className="muted tiny">{t.owner.categoryRatesHint}</p>
        {canWrite ? (
          <form className="owner-form compact" onSubmit={saveRate}>
            <label>
              {t.owner.fieldCategory}
              <select
                value={rateForm.category}
                onChange={(e) =>
                  setRateForm({ ...rateForm, category: e.target.value })
                }
              >
                <option value="DRINKING">{t.owner.catDrinking}</option>
                <option value="DISTILLED">{t.owner.catDistilled}</option>
                <option value="BATTERY">{t.owner.catBattery}</option>
                <option value="OTHER">{t.owner.catOther}</option>
              </select>
            </label>
            <label>
              {t.owner.chargePerUnit}
              <input
                type="number"
                min={0}
                step="0.01"
                value={rateForm.chargePerUnitBdt}
                onChange={(e) =>
                  setRateForm({ ...rateForm, chargePerUnitBdt: e.target.value })
                }
              />
            </label>
            <label>
              {t.owner.fieldNote}
              <input
                value={rateForm.note}
                onChange={(e) =>
                  setRateForm({ ...rateForm, note: e.target.value })
                }
              />
            </label>
            <button className="btn primary" type="submit">
              {t.common.save}
            </button>
          </form>
        ) : null}
        <ul className="plain-list">
          {rates.map((r) => (
            <li key={r.id}>
              <span>{categoryLabel(r.category)}</span>
              <span>৳{r.chargePerUnitBdt} / unit</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-card">
        <h2>{t.owner.couponsTitle}</h2>
        <p className="muted tiny">{t.owner.couponsHint}</p>
        {canWrite ? (
          <form className="owner-form compact" onSubmit={saveCoupon}>
            <label>
              {t.shop.fieldCoupon}
              <input
                required
                value={couponForm.code}
                onChange={(e) =>
                  setCouponForm({ ...couponForm, code: e.target.value })
                }
              />
            </label>
            <label>
              {t.owner.discountType}
              <select
                value={couponForm.discountType}
                onChange={(e) =>
                  setCouponForm({
                    ...couponForm,
                    discountType: e.target.value,
                  })
                }
              >
                <option value="PERCENT">%</option>
                <option value="FIXED">৳ fixed</option>
              </select>
            </label>
            <label>
              {t.owner.discountValue}
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={couponForm.discountValue}
                onChange={(e) =>
                  setCouponForm({
                    ...couponForm,
                    discountValue: e.target.value,
                  })
                }
              />
            </label>
            <label>
              {t.owner.minOrder}
              <input
                type="number"
                min={0}
                value={couponForm.minOrderBdt}
                onChange={(e) =>
                  setCouponForm({
                    ...couponForm,
                    minOrderBdt: e.target.value,
                  })
                }
              />
            </label>
            <button className="btn primary" type="submit">
              {t.owner.addCoupon}
            </button>
          </form>
        ) : null}
        <ul className="plain-list">
          {coupons.map((c) => (
            <li key={c.id}>
              <span>
                {c.code} · {c.discountType} {c.discountValue}
              </span>
              <span>
                used {c.usedCount}
                {c.isActive ? "" : " · off"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
