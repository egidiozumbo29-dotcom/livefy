"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PwaBootstrap() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* PWA stays optional. */
      });
    }

    const stored = window.localStorage.getItem("synthra:pwa-dismissed");
    setDismissed(stored === "1" || isStandalone());

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      if (!isStandalone()) setDismissed(false);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => null);
    setInstallEvent(null);
    setDismissed(true);
    window.localStorage.setItem("synthra:pwa-dismissed", "1");
  }

  function close() {
    setDismissed(true);
    window.localStorage.setItem("synthra:pwa-dismissed", "1");
  }

  if (dismissed || !installEvent) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-2xl border border-cam-orange/45 bg-cam-card/95 p-3 text-sm text-cam-text shadow-2xl shadow-black/70 backdrop-blur md:bottom-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cam-cta font-black text-cam-ink">
          S
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Installa Synthra</p>
          <p className="mt-0.5 text-xs leading-relaxed text-cam-muted">
            Aggiungi l&apos;app alla schermata Home per aprirla a tutto schermo
            su mobile e tablet.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={install}
              className="rounded-full bg-cam-cta px-3 py-1.5 text-xs font-black uppercase tracking-wide text-cam-ink"
            >
              Installa
            </button>
            <button
              type="button"
              onClick={close}
              className="rounded-full border border-cam-border px-3 py-1.5 text-xs font-semibold text-cam-muted"
            >
              Dopo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
