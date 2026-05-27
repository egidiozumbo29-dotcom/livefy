"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { apiFetch } from "@/services/api";
import { useAppSelector } from "@/store/hooks";

type Props = {
  userId: string;
  className?: string;
};

export function FollowButton({ userId, className }: Props) {
  const token = useAppSelector((s) => s.auth.token);
  const meId = useAppSelector((s) => s.auth.user?.id);
  const t = useTranslations("follow");
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token || !userId || meId === userId) {
      setFollowing(false);
      setReady(true);
      return;
    }
    apiFetch(`/follow/status/${userId}`)
      .then((r) => r.json())
      .then((d: { following?: boolean }) => {
        if (!cancelled) {
          setFollowing(!!d.following);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, userId, meId]);

  if (!token || meId === userId) return null;

  async function toggle() {
    setLoading(true);
    try {
      const res = await apiFetch(`/follow/${userId}`, {
        method: following ? "DELETE" : "POST",
      });
      if (res.ok) setFollowing((v) => !v);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading || !ready}
      className={
        className ??
        `rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition ${
          following
            ? "border border-cam-border bg-cam-card text-cam-muted hover:border-cam-orange hover:text-cam-orange-bright"
            : "bg-cam-cta text-cam-ink shadow hover:opacity-95"
        }`
      }
    >
      {loading ? "..." : following ? t("following") : t("follow")}
    </button>
  );
}
