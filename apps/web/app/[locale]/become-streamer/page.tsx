"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { submitStreamerKyc } from "@/services/auth-api";
import { persistAuth } from "@/services/session";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setCredentials } from "@/store/slices/authSlice";

export default function BecomeStreamerPage() {
  const router = useRouter();
  const t = useTranslations("becomeStreamer");
  const tNav = useTranslations("nav");
  const token = useAppSelector((s) => s.auth.token);
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const isCreator =
    user?.role === "MODEL" || user?.role === "ADMIN";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!idFile || !selfieFile) {
      setError(t("errorBothFiles"));
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("idDocument", idFile);
      fd.append("selfieWithId", selfieFile);
      const data = await submitStreamerKyc(fd);
      dispatch(setCredentials({ token: data.access_token, user: data.user }));
      persistAuth(data.access_token, data.user);
      await router.replace("/studio");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("retry"));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthScreen title={t("title")} subtitle={t("subtitle")}>
        <div className="rounded-md border border-cam-border bg-cam-card px-4 py-4 text-sm text-cam-text">
          {t("needLogin")}{" "}
          <Link href="/login" className="font-semibold text-cam-orange-bright hover:underline">
            {tNav("login")}
          </Link>
          .
        </div>
      </AuthScreen>
    );
  }

  if (isCreator) {
    return (
      <AuthScreen title={t("title")} subtitle={t("subtitle")}>
        <p className="rounded-md border border-cam-border bg-cam-card px-4 py-4 text-sm text-cam-muted">
          {t("alreadyCreator")}
        </p>
        <Link
          href="/studio"
          className="mt-4 inline-block w-full rounded-full bg-cam-cta py-2.5 text-center text-sm font-bold uppercase tracking-wide text-cam-ink shadow"
        >
          Studio
        </Link>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title={t("title")} subtitle={t("subtitle")}>
      <form onSubmit={onSubmit} className="form-panel">
        <label className="form-label">
          {t("idDocument")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
            className="form-input cursor-pointer py-2 file:mr-3 file:rounded-full file:border-0 file:bg-cam-ink file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-cam-orange-bright"
            onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
          />
          <span className="mt-1 block text-[11px] font-normal normal-case text-cam-muted">
            {t("idDocumentHint")}
          </span>
        </label>
        <label className="mt-6 form-label">
          {t("selfieWithId")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="form-input cursor-pointer py-2 file:mr-3 file:rounded-full file:border-0 file:bg-cam-ink file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-cam-orange-bright"
            onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)}
          />
          <span className="mt-1 block text-[11px] font-normal normal-case text-cam-muted">
            {t("selfieHint")}
          </span>
        </label>
        {error && (
          <p className="mt-4 rounded-md border border-red-500/40 bg-red-950/50 px-3 py-2 text-xs text-red-200">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-full bg-cam-cta py-2.5 text-sm font-bold uppercase tracking-wide text-cam-ink shadow disabled:opacity-50"
        >
          {loading ? t("submitLoading") : t("submit")}
        </button>
      </form>
    </AuthScreen>
  );
}
