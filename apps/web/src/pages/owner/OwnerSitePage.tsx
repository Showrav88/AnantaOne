import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getMessages, type LocaleCode } from "@anantaone/i18n";
import {
  api,
  type MediaAsset,
  type ShopBranding,
} from "../../lib/api";
import { getStoredUser } from "../../lib/session";

type Props = { locale: LocaleCode };

const FONTS = [
  { value: "source-sans", label: "Source Sans" },
  { value: "noto-bengali", label: "Noto Sans Bengali" },
  { value: "dm-sans", label: "DM Sans" },
  { value: "libre-baskerville", label: "Libre Baskerville" },
] as const;

export function OwnerSitePage({ locale }: Props) {
  const t = getMessages(locale);
  const user = getStoredUser();
  const canWrite = user?.role.code === "OWNER" || user?.role.code === "MANAGER";
  const [branding, setBranding] = useState<ShopBranding | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  async function load() {
    const [b, m] = await Promise.all([
      api.owner.branding(),
      api.owner.media(),
    ]);
    setBranding(b.branding);
    setAssets(m.assets);
  }

  useEffect(() => {
    startTransition(() => {
      void load().catch((err) =>
        setError(err instanceof Error ? err.message : "Failed"),
      );
    });
  }, []);

  async function saveTheme(e: FormEvent) {
    e.preventDefault();
    if (!branding || !canWrite) return;
    setError(null);
    setOkMsg(null);
    try {
      const res = await api.owner.updateBranding({
        brandPrimary: branding.brandPrimary,
        brandAccent: branding.brandAccent,
        brandBg: branding.brandBg,
        brandFont: branding.brandFont,
        siteHeadline: branding.siteHeadline,
        siteSubhead: branding.siteSubhead,
      });
      setBranding(res.branding);
      setOkMsg(t.owner.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function onUpload(
    file: File | null,
    purpose: "assets" | "logo" | "hero" | "products",
  ) {
    if (!file || !canWrite) return;
    setUploading(true);
    setError(null);
    setOkMsg(null);
    try {
      await api.owner.uploadMedia(file, purpose);
      await load();
      setOkMsg(t.owner.mediaUploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function assign(asset: MediaAsset, slot: "logo" | "heroImage" | "heroVideo") {
    if (!canWrite) return;
    setError(null);
    try {
      const body =
        slot === "logo"
          ? { logoAssetId: asset.id }
          : slot === "heroImage"
            ? { heroImageAssetId: asset.id }
            : { heroVideoAssetId: asset.id };
      const res = await api.owner.updateBranding(body);
      setBranding(res.branding);
      setOkMsg(t.owner.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  async function removeAsset(id: string) {
    if (!canWrite) return;
    setError(null);
    try {
      await api.owner.deleteMedia(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (!branding) {
    return <p className="muted">{error ?? t.common.loading}</p>;
  }

  return (
    <div className="owner-page">
      <header className="owner-header">
        <div>
          <p className="eyebrow">{t.owner.navSite}</p>
          <h1>{t.owner.siteTitle}</h1>
          <p className="muted">{t.owner.siteHint}</p>
        </div>
        <div className="header-links">
          <Link className="btn primary" to={`/shop/${branding.slug}`}>
            {t.owner.openPublicShop}
          </Link>
        </div>
      </header>

      {!branding.cloudinaryReady ? (
        <p className="error panel-card">
          {t.owner.cloudinaryMissing}
        </p>
      ) : null}

      {okMsg ? <p className="ok">{okMsg}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <section className="panel-card">
        <h2>{t.owner.siteTheme}</h2>
        <form className="owner-form compact" onSubmit={saveTheme}>
          <label>
            {t.owner.fieldBrandPrimary}
            <input
              type="color"
              value={branding.brandPrimary}
              disabled={!canWrite}
              onChange={(e) =>
                setBranding({ ...branding, brandPrimary: e.target.value })
              }
            />
          </label>
          <label>
            {t.owner.fieldBrandAccent}
            <input
              type="color"
              value={branding.brandAccent}
              disabled={!canWrite}
              onChange={(e) =>
                setBranding({ ...branding, brandAccent: e.target.value })
              }
            />
          </label>
          <label>
            {t.owner.fieldBrandBg}
            <input
              type="color"
              value={branding.brandBg}
              disabled={!canWrite}
              onChange={(e) =>
                setBranding({ ...branding, brandBg: e.target.value })
              }
            />
          </label>
          <label>
            {t.owner.fieldBrandFont}
            <select
              value={branding.brandFont}
              disabled={!canWrite}
              onChange={(e) =>
                setBranding({ ...branding, brandFont: e.target.value })
              }
            >
              {FONTS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="full">
            {t.owner.fieldSiteHeadline}
            <input
              value={branding.siteHeadline ?? ""}
              disabled={!canWrite}
              onChange={(e) =>
                setBranding({ ...branding, siteHeadline: e.target.value })
              }
            />
          </label>
          <label className="full">
            {t.owner.fieldSiteSubhead}
            <input
              value={branding.siteSubhead ?? ""}
              disabled={!canWrite}
              onChange={(e) =>
                setBranding({ ...branding, siteSubhead: e.target.value })
              }
            />
          </label>
          {canWrite ? (
            <button className="cta" type="submit" disabled={pending}>
              {t.common.save}
            </button>
          ) : null}
        </form>
      </section>

      <section className="panel-card site-preview-strip">
        <h2>{t.owner.sitePreview}</h2>
        <div className="site-brand-preview">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.name} />
          ) : (
            <span className="muted">{t.owner.noLogoYet}</span>
          )}
          {branding.heroImageUrl ? (
            <img src={branding.heroImageUrl} alt="" />
          ) : null}
          {branding.heroVideoUrl ? (
            <video src={branding.heroVideoUrl} muted controls playsInline />
          ) : null}
        </div>
        {canWrite ? (
          <div className="site-upload-row">
            <label className="btn ghost compact">
              {t.owner.uploadLogo}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={uploading}
                onChange={(e) =>
                  void onUpload(e.target.files?.[0] ?? null, "logo")
                }
              />
            </label>
            <label className="btn ghost compact">
              {t.owner.uploadHeroImage}
              <input
                type="file"
                accept="image/*"
                hidden
                disabled={uploading}
                onChange={(e) =>
                  void onUpload(e.target.files?.[0] ?? null, "hero")
                }
              />
            </label>
            <label className="btn ghost compact">
              {t.owner.uploadHeroVideo}
              <input
                type="file"
                accept="video/*"
                hidden
                disabled={uploading}
                onChange={(e) =>
                  void onUpload(e.target.files?.[0] ?? null, "hero")
                }
              />
            </label>
            <label className="btn ghost compact">
              {t.owner.uploadAsset}
              <input
                type="file"
                accept="image/*,video/*"
                hidden
                disabled={uploading}
                onChange={(e) =>
                  void onUpload(e.target.files?.[0] ?? null, "assets")
                }
              />
            </label>
          </div>
        ) : null}
      </section>

      <section className="panel-card">
        <h2>{t.owner.mediaLibrary}</h2>
        <p className="muted tiny">{t.owner.mediaLibraryHint}</p>
        {assets.length === 0 ? (
          <p className="muted">{t.owner.mediaEmpty}</p>
        ) : (
          <ul className="media-grid">
            {assets.map((asset) => (
              <li key={asset.id}>
                {asset.kind === "VIDEO" ? (
                  <video src={asset.url} muted controls playsInline />
                ) : (
                  <img src={asset.url} alt={asset.label ?? asset.originalName ?? ""} />
                )}
                <p className="muted tiny">
                  {asset.folder.replace(/^anantaone\//, "")}
                </p>
                {canWrite ? (
                  <div className="media-actions">
                    {asset.kind === "IMAGE" ? (
                      <>
                        <button
                          type="button"
                          className="btn ghost compact"
                          onClick={() => void assign(asset, "logo")}
                        >
                          {t.owner.useAsLogo}
                        </button>
                        <button
                          type="button"
                          className="btn ghost compact"
                          onClick={() => void assign(asset, "heroImage")}
                        >
                          {t.owner.useAsHero}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn ghost compact"
                        onClick={() => void assign(asset, "heroVideo")}
                      >
                        {t.owner.useAsHeroVideo}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn ghost compact dark"
                      onClick={() => void removeAsset(asset.id)}
                    >
                      {t.common.delete}
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
