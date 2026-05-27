"use client";

import { Link } from "@/i18n/navigation";
import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateBalance } from "@/store/slices/authSlice";
import { apiFetch } from "@/services/api";

type Props = {
  creatorId: string;
  streamId?: string | null;
};

export function TipPanel({ creatorId, streamId }: Props) {
  const token = useAppSelector((s) => s.auth.token);
  const balance = useAppSelector((s) => s.auth.user?.balance ?? 0);
  const dispatch = useAppDispatch();
  const [amount, setAmount] = useState(20);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendTip() {
    if (!token) {
      setStatus("Accedi per inviare mance.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await apiFetch("/tips", {
        method: "POST",
        body: JSON.stringify({
          receiverId: creatorId,
          amount,
          streamId: streamId ?? undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(
          typeof body.message === "string"
            ? body.message
            : "Tip non riuscito."
        );
        return;
      }
      setStatus("Mancia inviata!");
      const me = await apiFetch("/users/me");
      if (me.ok) {
        const u = await me.json();
        if (typeof u.balance === "number") dispatch(updateBalance(u.balance));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-cam-border bg-cam-card p-4">
      <h3 className="text-sm font-semibold text-cam-text">Mancia</h3>
      <p className="mt-1 text-xs text-cam-muted">
        Wallet:{" "}
        <span className="tabular-nums text-cam-text">{balance}</span> token
      </p>
      <div className="mt-3 flex gap-2">
        <input
          type="number"
          min={1}
          max={500000}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-28 rounded-lg border border-cam-border bg-cam-ink px-2 py-1.5 text-sm text-cam-text"
        />
        <button
          type="button"
          disabled={loading}
          onClick={() => sendTip()}
          className="rounded-lg bg-cam-cta px-4 py-1.5 text-xs font-semibold text-cam-ink disabled:opacity-50"
        >
          {loading ? "Invio…" : "Invia tip"}
        </button>
      </div>
      {status && (
        <p className="mt-2 text-xs text-cam-muted" role="status">
          {status === "Accedi per inviare mance." ? (
            <>
              <Link href="/login" className="text-cam-orange-bright hover:underline">
                Accedi
              </Link>{" "}
              per inviare mance.
            </>
          ) : (
            status
          )}
        </p>
      )}
    </div>
  );
}
