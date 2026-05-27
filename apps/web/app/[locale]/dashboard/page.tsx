"use client";

import { useRouter } from "@/i18n/navigation";
import { useEffect } from "react";
import { useAppSelector } from "@/store/hooks";

/** Alias role-aware: /dashboard porta ogni ruolo alla sua area principale. */
export default function DashboardRedirectPage() {
  const router = useRouter();
  const token = useAppSelector((s) => s.auth.token);
  const role = useAppSelector((s) => s.auth.user?.role);

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }
    if (role === "ADMIN") {
      router.replace("/admin/payouts");
      return;
    }
    if (role === "MODEL" || role === "MODERATOR") {
      router.replace("/studio");
      return;
    }
    router.replace("/profile");
  }, [router, role, token]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 bg-cam-bg px-4 text-sm text-cam-muted">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-cam-border border-t-cam-orange" />
      Reindirizzamento alla dashboard…
    </div>
  );
}
