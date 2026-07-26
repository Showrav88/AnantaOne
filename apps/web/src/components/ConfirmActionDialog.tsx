import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ConfirmDetail = {
  label: string;
  value: string | number | null | undefined;
};

export type ConfirmTone = "create" | "update" | "danger" | "info";

export type ConfirmActionOptions = {
  title: string;
  /** Short sentence under the title */
  message?: string;
  /** Exact values that will be written / removed */
  details?: ConfirmDetail[];
  confirmLabel: string;
  cancelLabel: string;
  tone?: ConfirmTone;
  /** When set, confirm stays disabled until reason meets min length */
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonMinLength?: number;
};

export type ConfirmActionResult =
  | { ok: true; reason?: string }
  | { ok: false };

type Pending = ConfirmActionOptions & {
  resolve: (result: ConfirmActionResult) => void;
};

type ConfirmActionApi = {
  confirm: (opts: ConfirmActionOptions) => Promise<ConfirmActionResult>;
};

const ConfirmActionContext = createContext<ConfirmActionApi | null>(null);

function formatDetailValue(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

export function ConfirmActionProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const titleId = useId();
  const resolveRef = useRef<Pending["resolve"] | null>(null);

  const confirm = useCallback((opts: ConfirmActionOptions) => {
    return new Promise<ConfirmActionResult>((resolve) => {
      resolveRef.current = resolve;
      setReason("");
      setPending({ ...opts, resolve });
    });
  }, []);

  const close = useCallback((result: ConfirmActionResult) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setPending(null);
    setReason("");
    resolve?.(result);
  }, []);

  useEffect(() => {
    if (!pending) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close({ ok: false });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, close]);

  const api = useMemo(() => ({ confirm }), [confirm]);

  const tone = pending?.tone ?? "info";
  const minLen = pending?.reasonMinLength ?? 0;
  const needsReason = Boolean(pending?.reasonLabel);
  const reasonOk = !needsReason || reason.trim().length >= Math.max(1, minLen);

  return (
    <ConfirmActionContext.Provider value={api}>
      {children}
      {pending ? (
        <div
          className="owner-dialog-backdrop no-print"
          role="presentation"
          onClick={() => close({ ok: false })}
        >
          <div
            className={`owner-dialog confirm confirm-action tone-${tone}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={titleId}>{pending.title}</h2>
            {pending.message ? <p>{pending.message}</p> : null}
            {pending.details && pending.details.length > 0 ? (
              <dl className="confirm-detail-grid">
                {pending.details.map((row) => (
                  <div key={`${row.label}-${formatDetailValue(row.value)}`} className="confirm-detail-row">
                    <dt>{row.label}</dt>
                    <dd>{formatDetailValue(row.value)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {pending.reasonLabel ? (
              <label className="full">
                {pending.reasonLabel}
                <textarea
                  rows={3}
                  value={reason}
                  placeholder={pending.reasonPlaceholder}
                  onChange={(e) => setReason(e.target.value)}
                  autoFocus
                />
              </label>
            ) : null}
            <div className="form-actions">
              <button
                type="button"
                className={tone === "danger" ? "btn danger" : "btn primary"}
                disabled={!reasonOk}
                onClick={() =>
                  close({
                    ok: true,
                    reason: needsReason ? reason.trim() : undefined,
                  })
                }
              >
                {pending.confirmLabel}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => close({ ok: false })}
              >
                {pending.cancelLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmActionContext.Provider>
  );
}

export function useConfirmAction(): ConfirmActionApi {
  const ctx = useContext(ConfirmActionContext);
  if (!ctx) {
    throw new Error("useConfirmAction must be used within ConfirmActionProvider");
  }
  return ctx;
}

/** Build detail rows, skipping empty optional values when skipEmpty is true. */
export function confirmDetails(
  rows: ConfirmDetail[],
  opts?: { skipEmpty?: boolean },
): ConfirmDetail[] {
  if (!opts?.skipEmpty) return rows;
  return rows.filter(
    (r) => r.value != null && String(r.value).trim() !== "",
  );
}
