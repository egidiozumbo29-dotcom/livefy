"use client";

import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { loginRequest } from "@/services/auth-api";
import { persistAuth } from "@/services/session";
import { useAppDispatch } from "@/store/hooks";
import { setCredentials } from "@/store/slices/authSlice";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("authLogin");
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await loginRequest(email, password);
      dispatch(setCredentials({ token: data.access_token, user: data.user }));
      persistAuth(data.access_token, data.user);
      await router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("retry"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen title={t("title")} subtitle={t("subtitle")}>
      <form onSubmit={onSubmit} className="form-panel">
          <label className="form-label">
            {t("email")}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input text-violet-custom"
            />
          </label>
          <label className="mt-4 form-label">
            {t("password")}
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input text-violet-custom"
            />
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
            <Link href="/register" className="font-semibold text-cam-orange-bright hover:underline">
              {t("registerLink")}
            </Link>
          </p>
        </form>
    </AuthScreen>
  );
}
