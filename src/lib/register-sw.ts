// Guarded service-worker registration for the Puzzle PWA.
// Registers only in production on real published hosts — never in preview/dev/iframe.

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const url = new URL(window.location.href);
  const host = window.location.hostname;
  const inIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();

  const blocked =
    !import.meta.env.PROD ||
    inIframe ||
    url.searchParams.get("sw") === "off" ||
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");

  if (blocked) {
    navigator.serviceWorker.getRegistrations?.().then((regs) => {
      for (const r of regs) {
        if (r.active?.scriptURL?.endsWith("/sw.js")) r.unregister().catch(() => {});
      }
    }).catch(() => {});
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  });
}
