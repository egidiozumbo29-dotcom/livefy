"use client";

import { useEffect, useState } from "react";

type TipDetail = {
  username: string;
  amount: number;
  streamId: string | null;
  bigTip?: boolean;
};

type ActiveBurst = TipDetail & {
  id: string;
  emoji: string;
};

const BURST_EMOJIS = ["🚀", "❤️", "💎", "🌟", "🎉", "💥"];

function emojiForAmount(amount: number) {
  if (amount >= 500) return "💎";
  if (amount >= 200) return "🚀";
  if (amount >= 100) return "🌟";
  if (amount >= 50) return "🎉";
  if (amount >= 20) return "❤️";
  return BURST_EMOJIS[Math.floor(Math.random() * BURST_EMOJIS.length)];
}

const BURST_DURATION_MS = 4500;

export function TipBurst() {
  const [bursts, setBursts] = useState<ActiveBurst[]>([]);

  useEffect(() => {
    function onTip(e: Event) {
      const ev = e as CustomEvent<TipDetail>;
      const detail = ev.detail;
      if (!detail) return;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const next: ActiveBurst = {
        id,
        username: detail.username,
        amount: detail.amount,
        streamId: detail.streamId,
        bigTip: detail.bigTip,
        emoji: emojiForAmount(detail.amount),
      };
      setBursts((prev) => [...prev, next]);
      window.setTimeout(() => {
        setBursts((prev) => prev.filter((b) => b.id !== id));
      }, BURST_DURATION_MS);
    }
    window.addEventListener("synthra:tip", onTip);
    return () => window.removeEventListener("synthra:tip", onTip);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {bursts.map((b, idx) => (
        <div
          key={b.id}
          className="absolute"
          style={{
            left: `${10 + ((idx * 17) % 80)}%`,
            bottom: "10%",
            animation: `tipBurstRise ${BURST_DURATION_MS}ms cubic-bezier(0.2,0.8,0.2,1) forwards`,
          }}
        >
          <div
            className={`flex items-center rounded-full border font-bold shadow-lg ${
              b.bigTip === true
                ? "gap-3 border-amber-200/65 bg-gradient-to-r from-amber-600/95 to-orange-950/96 px-4 py-2 text-[15px] text-white ring-2 ring-amber-300/55"
                : "gap-2 border-cam-orange/50 bg-cam-card/95 px-3 py-1.5 text-sm text-cam-text"
            }`}
          >
            <span className={b.bigTip === true ? "text-xl" : "text-base"}>
              {b.emoji}
            </span>
            <span className="truncate">{b.username}</span>
            <span
              className={
                b.bigTip === true ? "font-black text-white" : "text-cam-orange-bright"
              }
            >
              +{b.amount} tk
            </span>
          </div>
        </div>
      ))}
      <style jsx>{`
        @keyframes tipBurstRise {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0.6);
          }
          15% {
            opacity: 1;
            transform: translateY(-30px) scale(1);
          }
          85% {
            opacity: 1;
            transform: translateY(-200px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-260px) scale(0.85);
          }
        }
      `}</style>
    </div>
  );
}
