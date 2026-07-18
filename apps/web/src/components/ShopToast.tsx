import { useEffect } from "react";

export type ShopToastMessage = {
  id: number;
  text: string;
  tone?: "ok" | "warn" | "info";
};

type Props = {
  toast: ShopToastMessage | null;
  onDone: () => void;
};

export function ShopToast({ toast, onDone }: Props) {
  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(onDone, 2200);
    return () => window.clearTimeout(handle);
  }, [toast, onDone]);

  if (!toast) return null;

  return (
    <div
      className={`shop-toast shop-toast-${toast.tone ?? "ok"}`}
      role="status"
      aria-live="polite"
    >
      {toast.text}
    </div>
  );
}

let toastSeq = 1;

export function makeToast(
  text: string,
  tone: ShopToastMessage["tone"] = "ok",
): ShopToastMessage {
  toastSeq += 1;
  return { id: toastSeq, text, tone };
}
