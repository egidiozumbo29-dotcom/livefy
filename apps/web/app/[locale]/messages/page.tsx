import { Suspense } from "react";
import { MessagesClient } from "./messages-client";

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-zinc-500">
          Carico messaggi…
        </div>
      }
    >
      <MessagesClient />
    </Suspense>
  );
}
