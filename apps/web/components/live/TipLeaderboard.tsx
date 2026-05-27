"use client";



import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/services/api";



type LeaderboardRow = {

  rank: number;

  sender: { id: string; username: string; avatarUrl: string | null };

  tokens: number;

};



type Props = {

  streamId: string | null | undefined;

  /** Quanti tipper esporre (default 5). */

  take?: number;

};



const REFRESH_MS = 15_000;



export function TipLeaderboard({ streamId, take = 5 }: Props) {

  const [rows, setRows] = useState<LeaderboardRow[]>([]);

  const [loading, setLoading] = useState(false);



  const load = useCallback(async () => {

    if (!streamId) {

      setRows([]);

      return;

    }

    try {

      setLoading(true);

      const res = await apiFetch(`/tips/leaderboard/${streamId}?take=${take}`);

      if (!res.ok) {

        setRows([]);

        return;

      }

      const data = (await res.json()) as LeaderboardRow[];

      setRows(Array.isArray(data) ? data : []);

    } catch {

      setRows([]);

    } finally {

      setLoading(false);

    }

  }, [streamId, take]);



  useEffect(() => {

    load();

    if (!streamId) return;

    const tmr = window.setInterval(load, REFRESH_MS);



    function onTip() {

      load();

    }

    window.addEventListener("synthra:tip", onTip as EventListener);



    return () => {

      window.clearInterval(tmr);

      window.removeEventListener("synthra:tip", onTip as EventListener);

    };

  }, [load, streamId]);



  if (!streamId) return null;

  if (!rows.length && !loading) {

    return (

      <div className="rounded-md border border-cam-border bg-cam-card px-3 py-2 text-[11px] text-cam-muted">

        Nessun tipper ancora. Sii il primo!

      </div>

    );

  }



  return (

    <div className="rounded-md border border-cam-orange/25 bg-gradient-to-r from-cam-card via-cam-ink to-cam-card px-3 py-2 shadow-[0_4px_20px_rgba(0,0,0,0.35)]">

      <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-cam-orange-bright">

        <span>🏆 Top tipper della live</span>

        {loading && <span className="text-cam-muted">…</span>}

      </div>

      <ol className="space-y-1">

        {rows.map((r) => (

          <li

            key={r.sender.id}

            className="flex items-center justify-between gap-2 text-xs"

          >

            <span className="flex min-w-0 items-center gap-2">

              <span

                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${

                  r.rank === 1

                    ? "bg-cam-orange text-cam-ink"

                    : r.rank === 2

                      ? "bg-cam-muted text-cam-ink"

                      : r.rank === 3

                        ? "bg-cam-orange-dim text-cam-text"

                        : "bg-cam-card text-cam-muted"

                }`}

              >

                {r.rank}

              </span>

              <span className="truncate font-bold text-cam-text">

                {r.sender.username}

              </span>

            </span>

            <span className="shrink-0 font-bold text-cam-orange-bright">

              {r.tokens} tk

            </span>

          </li>

        ))}

      </ol>

    </div>

  );

}

