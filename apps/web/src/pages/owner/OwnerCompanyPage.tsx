import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import { api, type CompanyDetails, type GeoPlace } from "../../lib/api";
import { getStoredUser } from "../../lib/session";
import { uploadTenantMedia } from "../../lib/tenantUpload";

type Props = { locale: LocaleCode };

export function OwnerCompanyPage({ locale }: Props) {
  const t = getMessages(locale);
  const user = getStoredUser();
  const canWrite = user?.role.code === "OWNER" || user?.role.code === "MANAGER";
  const [company, setCompany] = useState<CompanyDetails>();
  const [divisions, setDivisions] = useState<GeoPlace[]>([]);
  const [districts, setDistricts] = useState<GeoPlace[]>([]);
  const [upazilas, setUpazilas] = useState<GeoPlace[]>([]);
  const [setupAreas, setSetupAreas] = useState(true);
  const [wardCount, setWardCount] = useState("15");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(() => {
      void (async () => {
        try {
          const [res, divs] = await Promise.all([
            api.owner.company(),
            api.geo.divisions(),
          ]);
          setCompany(res.company);
          setDivisions(divs.divisions);
          if (res.company.divisionId) {
            const d = await api.geo.districts(res.company.divisionId);
            setDistricts(d.districts);
          }
          if (res.company.districtId) {
            const u = await api.geo.upazilas(res.company.districtId);
            setUpazilas(u.upazilas);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed");
        }
      })();
    });
  }, []);

  async function onDivisionChange(divisionId: string) {
    if (!company) return;
    setCompany({
      ...company,
      divisionId: divisionId || null,
      districtId: null,
      upazilaId: null,
    });
    setUpazilas([]);
    if (!divisionId) {
      setDistricts([]);
      return;
    }
    const d = await api.geo.districts(divisionId);
    setDistricts(d.districts);
  }

  async function onDistrictChange(districtId: string) {
    if (!company) return;
    setCompany({
      ...company,
      districtId: districtId || null,
      upazilaId: null,
    });
    if (!districtId) {
      setUpazilas([]);
      return;
    }
    const u = await api.geo.upazilas(districtId);
    setUpazilas(u.upazilas);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!company) return;
    setSaved(false);
    setError(null);
    try {
      const res = await api.owner.updateCompany({
        name: company.name,
        phone: company.phone,
        address: company.address,
        divisionId: company.divisionId ?? null,
        districtId: company.districtId ?? null,
        upazilaId: company.upazilaId ?? null,
        setupDeliveryAreas: setupAreas && Boolean(company.upazilaId),
        wardCount: Number(wardCount) || 15,
        freeWardCount: 5,
        tagline: company.tagline,
        description: company.description,
        locale: company.locale as "bn" | "en",
      });
      setCompany(res.company);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function onLogoUpload(file: File | null) {
    if (!file || !canWrite) return;
    setUploading(true);
    setError(null);
    try {
      await uploadTenantMedia({ file, purpose: "logo" });
      const res = await api.owner.company();
      setCompany(res.company);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function placeLabel(p: GeoPlace) {
    return locale === "bn" && p.nameBn ? p.nameBn : p.name;
  }

  if (!company) {
    return <p className="muted">{error ?? t.common.loading}</p>;
  }

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.owner.navCompany}</p>
          <h1>{t.owner.companyTitle}</h1>
          <p className="muted">{t.owner.companyHint}</p>
        </div>
        <div className="header-links">
          <Link className="btn ghost" to="/owner/delivery">
            {t.owner.navDelivery}
          </Link>
          <Link className="btn primary" to="/owner/site">
            {t.owner.navSite}
          </Link>
        </div>
      </header>

      <section className="panel-card upload-panel">
        <h2>{t.owner.uploadLogo}</h2>
        <p className="muted tiny">{t.owner.uploadLogoHint}</p>
        <div className="site-brand-preview company-logo-preview">
          {company.logoUrl ? (
            <img src={company.logoUrl} alt={company.name} />
          ) : (
            <span className="muted">{t.owner.noLogoYet}</span>
          )}
        </div>
        {canWrite ? (
          <label className="upload-field">
            <span className="upload-field-title">{t.owner.chooseLogoFile}</span>
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                void onLogoUpload(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
        ) : (
          <p className="muted">{t.owner.readOnlyHint}</p>
        )}
        {uploading ? <p className="muted">{t.owner.uploading}</p> : null}
      </section>

      <form className="owner-form" onSubmit={onSubmit}>
        <label>
          {t.owner.fieldName}
          <input
            value={company.name}
            onChange={(e) => setCompany({ ...company, name: e.target.value })}
            required
          />
        </label>
        <label>
          {t.owner.fieldPhone}
          <input
            value={company.phone ?? ""}
            onChange={(e) => setCompany({ ...company, phone: e.target.value })}
          />
        </label>

        <label>
          {t.owner.fieldDivision}
          <select
            value={company.divisionId ?? ""}
            disabled={!canWrite}
            onChange={(e) => void onDivisionChange(e.target.value)}
          >
            <option value="">{t.owner.selectDivision}</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {placeLabel(d)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.owner.fieldDistrict}
          <select
            value={company.districtId ?? ""}
            disabled={!canWrite || !company.divisionId}
            onChange={(e) => void onDistrictChange(e.target.value)}
          >
            <option value="">{t.owner.selectDistrict}</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {placeLabel(d)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.owner.fieldUpazila}
          <select
            value={company.upazilaId ?? ""}
            disabled={!canWrite || !company.districtId}
            onChange={(e) =>
              setCompany({ ...company, upazilaId: e.target.value || null })
            }
          >
            <option value="">{t.owner.selectUpazila}</option>
            {upazilas.map((u) => (
              <option key={u.id} value={u.id}>
                {placeLabel(u)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.owner.fieldStreetAddress}
          <input
            value={company.address ?? ""}
            placeholder={t.owner.streetAddressHint}
            onChange={(e) => setCompany({ ...company, address: e.target.value })}
          />
        </label>

        {canWrite ? (
          <>
            <label className="check full">
              <input
                type="checkbox"
                checked={setupAreas}
                onChange={(e) => setSetupAreas(e.target.checked)}
              />
              <span>{t.owner.setupDeliveryAreas}</span>
            </label>
            {setupAreas ? (
              <label>
                {t.owner.wardCount}
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={wardCount}
                  onChange={(e) => setWardCount(e.target.value)}
                />
              </label>
            ) : null}
          </>
        ) : null}

        <label>
          {t.owner.fieldTagline}
          <input
            value={company.tagline ?? ""}
            onChange={(e) => setCompany({ ...company, tagline: e.target.value })}
          />
        </label>
        <label className="full">
          {t.owner.fieldDescription}
          <textarea
            rows={4}
            value={company.description ?? ""}
            onChange={(e) =>
              setCompany({ ...company, description: e.target.value })
            }
          />
        </label>
        <div className="form-actions">
          <button className="btn primary" type="submit" disabled={pending || !canWrite}>
            {t.common.save}
          </button>
          {saved ? <span className="ok">{t.owner.saved}</span> : null}
          {error ? <span className="error">{error}</span> : null}
        </div>
      </form>

      <p className="muted tiny">{t.owner.locationDeliveryHint}</p>

      <section className="owner-panels single">
        <div>
          <div className="panel-heading-row">
            <h2>{t.home.branchesLabel}</h2>
            <Link className="btn ghost" to="/owner/branches">
              {t.owner.manageBranchesLink}
            </Link>
          </div>
          <ul className="plain-list">
            {company.branches.map((b) => (
              <li key={b.id}>
                <span>
                  {b.name}
                  {b.isActive === false ? " · —" : ""}
                </span>
                <span>{b.address ?? "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
