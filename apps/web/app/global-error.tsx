"use client";

import { useEffect } from "react";

/** Cattura errori sopra `[locale]` (es. problema nel root layout hydration). Richiede <html>/<body>. */
export default function GlobalError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    console.error("[global:error]", error);
  }, [error]);

  return (
    <html lang="it">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "#19191c",
          color: "#e8e8ec",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 800 }}>Errore interno / Internal error</h1>
        <p style={{ maxWidth: 420, color: "#9a9aaa", fontSize: 14, lineHeight: 1.5 }}>
          Il sito non ha potuto avviare questa schermata. Prova a ricaricare.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: 16,
            padding: "10px 20px",
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            fontWeight: 700,
            background: "#ff8c00",
            color: "#0d0d0f",
          }}
        >
          Ricarica / Reload
        </button>
      </body>
    </html>
  );
}
