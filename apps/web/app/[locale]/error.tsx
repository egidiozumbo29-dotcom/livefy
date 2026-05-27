"use client";

/* eslint-disable @next/next/no-html-link-for-pages */
import { useEffect } from "react";

/**
 * Senza next-intl né Link localizzato: se l’errore riguarda anche i provider di traduzioni,
 * evitiamo un crash a cascata (pagina bianca).
 */
export default function LocaleRouteError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    console.error("[locale:error]", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#19191c] px-4 text-center text-[#e8e8ec]">
      <div className="max-w-md space-y-2">
        <h1 className="text-lg font-black">Errore / Error</h1>
        <p className="text-sm text-[#9a9aaa]">
          La pagina non ha potuto caricarsi. Puoi riprovare o tornare alla home.
          <br />
          This page crashed. Retry or open the site home.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-[#ff8c00] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#0d0d0f]"
        >
          Riprova / Retry
        </button>
        <a
          href="/"
          className="rounded-full border border-[#2e2e35] px-4 py-2 text-xs font-semibold text-[#c8c8d2] hover:border-[#ff8c00]"
        >
          Home (IT)
        </a>
        <a
          href="/en"
          className="rounded-full border border-[#2e2e35] px-4 py-2 text-xs font-semibold text-[#c8c8d2] hover:border-[#ff8c00]"
        >
          Home (EN)
        </a>
      </div>
      {process.env.NODE_ENV !== "production" && error.message ? (
        <pre className="mt-4 max-h-40 max-w-xl overflow-auto rounded border border-red-900/50 bg-black/60 p-2 text-left font-mono text-[10px] text-red-200">
          {error.message}
          {error.digest ? `\ndigest: ${error.digest}` : ""}
        </pre>
      ) : null}
    </div>
  );
}
