import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

type Props = {
  readerId: string;
  active: boolean;
  onScan: (decoded: string) => void;
  onError?: (message: string) => void;
  stopLabel: string;
  onStop: () => void;
};

/** Small camera QR panel — same pattern as invoice scan on Sales History. */
export function QrScannerPanel({
  readerId,
  active,
  onScan,
  onError,
  stopLabel,
  onStop,
}: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!active) {
      void stop();
      return;
    }
    handledRef.current = false;
    let cancelled = false;
    void (async () => {
      setStarting(true);
      await new Promise((r) => setTimeout(r, 50));
      if (cancelled) return;
      try {
        const scanner = new Html5Qrcode(readerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 220, height: 220 } },
          (decoded) => {
            if (handledRef.current) return;
            handledRef.current = true;
            void (async () => {
              await stop();
              onStop();
              onScan(decoded);
            })();
          },
          () => {
            /* frame miss */
          },
        );
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Camera failed");
        onStop();
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
      void stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- start once per active
  }, [active, readerId]);

  async function stop() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
    }
  }

  if (!active) return null;

  return (
    <div className="qr-scan-panel">
      <div id={readerId} className="qr-reader active" />
      {starting ? <p className="muted tiny">…</p> : null}
      <button type="button" className="btn ghost" onClick={onStop}>
        {stopLabel}
      </button>
    </div>
  );
}
