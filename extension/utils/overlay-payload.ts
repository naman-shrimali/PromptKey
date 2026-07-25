// Contract between the background worker and the injected overlay.
export type OverlayPayload =
    | {
          kind: "qr";
          mode: "offline" | "link";
          qrValue: string; // raw text (offline) or short URL (link)
          url?: string;
          badge: string;
      }
    | { kind: "error"; message: string };

declare global {
    interface Window {
        __pkShowOverlay?: (payload: OverlayPayload) => void;
    }
}
