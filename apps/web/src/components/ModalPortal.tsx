import { createPortal } from "react-dom";
import type { ReactNode } from "react";

/** Render modals on document.body so fixed overlays are not clipped by owner-main. */
export function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
