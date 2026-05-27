"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { registerRequest } from "@/services/auth-api";
import { persistAuth } from "@/services/session";
import { useAppDispatch } from "@/store/hooks";
import { setCredentials } from "@/store/slices/authSlice";

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations("authRegister");
  const dispatch = useAppDispatch();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [country, setCountry] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!ageConfirmed) {
      setError(t("ageError"));
      return;
    }
    setLoading(true);
    try {
      const data = await registerRequest({
        username,
        email,
        password,
        birthDate: new Date(birthDate).toISOString(),
        country: country || undefined,
        ageConfirmed: true,
      });
      dispatch(setCredentials({ token: data.access_token, user: data.user }));
      persistAuth(data.access_token, data.user);
      await router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("retry"));
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "form-input";
  const labelCls = "form-label";

  return (
    <AuthScreen title={t("title")} subtitle={t("subtitle")}>
      <form onSubmit={onSubmit} className="form-panel">
          <label className={labelCls}>
            {t("username")}
            <input
              type="text"
              required
              minLength={3}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className={`mt-4 ${labelCls}`}>
            {t("email")}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className={`mt-4 ${labelCls}`}>
            {t("password")}
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className={`mt-4 ${labelCls}`}>
            {t("birthDate")}
            <input
              type="date"
              required
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className={`mt-4 ${labelCls}`}>
            {t("countryOptional")}
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-xs text-cam-muted">
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(e) => setAgeConfirmed(e.target.checked)}
              className="mt-1 rounded border-cam-border bg-cam-ink text-cam-orange accent-cam-orange"
            />
            <span>{t("ageConfirm")}</span>
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
          <p className="mt-4 text-center text-xs text-cam-muted">
            {t("footer")}{" "}
            <Link href="/login" className="font-semibold text-cam-orange-bright hover:underline">
              {t("loginLink")}
            </Link>
          </p>
        </form>
    </AuthScreen>
  );
}
