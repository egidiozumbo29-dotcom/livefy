import { Suspense } from "react";
import { DiscoverClient } from "./discover-client";

export const metadata = {
  title: "Scopri",
};

export default function DiscoverPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-cam-bg px-4">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-cam-border border-t-cam-orange" />
          <p className="text-sm text-cam-muted">Carico…</p>
        </div>
      }
    >
      <DiscoverClient />
    </Suspense>
  );
}
