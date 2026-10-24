"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { apiFetch } from "@/services/api";
import { useAppSelector } from "@/store/hooks";

export default function BecomeStreamerPage() {
  const router = useRouter();
  const t = useTranslations("becomeStreamer");
  const tNav = useTranslations("nav");
  const token = useAppSelector((s) => s.auth.token);
  const user = useAppSelector((s) => s.auth.user);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [realName, setRealName] = useState("");
  const [realAddress, setRealAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [taxId, setTaxId] = useState("");

  const isCreator =
    user?.role === "MODEL" || user?.role === "ADMIN";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!idFile || !selfieFile) {
      setError("Devi caricare entrambi i documenti");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("idDocument", idFile);
      fd.append("selfieWithId", selfieFile);
      fd.append("realName", realName);
      fd.append("realAddress", realAddress);
      fd.append("phoneNumber", phoneNumber);
      fd.append("taxId", taxId);

      const res = await apiFetch("/verifications", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Errore durante l'invio");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante l'invio");
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

  if (success) {
    return (
      <AuthScreen title={t("title")} subtitle={t("subtitle")}>
        <div className="rounded-md border border-emerald-500/30 bg-emerald-950/35 px-4 py-4 text-sm text-emerald-100">
          <p className="font-bold">Richiesta inviata con successo!</p>
          <p className="mt-2">
            La tua richiesta è in revisione. Riceverai una notifica quando verrà approvata.
          </p>
        </div>
        <Link
          href="/"
          className="mt-4 inline-block w-full rounded-full bg-cam-cta py-2.5 text-center text-sm font-bold uppercase tracking-wide text-cam-ink shadow"
        >
          Torna alla home
        </Link>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen title={t("title")} subtitle={t("subtitle")}>
      <form onSubmit={onSubmit} className="form-panel">
        <label className="form-label">
          Nome reale completo
          <input
            type="text"
            required
            value={realName}
            onChange={(e) => setRealName(e.target.value)}
            className="form-input text-violet-custom"
          />
        </label>
        <label className="mt-4 form-label">
          Indirizzo completo
          <input
            type="text"
            required
            value={realAddress}
            onChange={(e) => setRealAddress(e.target.value)}
            className="form-input text-violet-custom"
          />
        </label>
        <label className="mt-4 form-label">
          Numero di telefono
          <input
            type="tel"
            required
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="form-input text-violet-custom"
          />
        </label>
        <label className="mt-4 form-label">
          Codice fiscale / VAT (opzionale)
          <input
            type="text"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            className="form-input text-violet-custom"
          />
        </label>
        <label className="mt-6 form-label">
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
          {loading ? "Invio in corso..." : "Invia richiesta"}
        </button>
      </form>
    </AuthScreen>
  );
}
