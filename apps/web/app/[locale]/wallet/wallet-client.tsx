"use client";

import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch, apiUrl, fetchWithTimeout } from "@/services/api";
import { formatInteger, formatIsoUtc } from "@/lib/format";
import { FALLBACK_TOKEN_PACKS } from "@/lib/token-packs-fallback";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setCredentials } from "@/store/slices/authSlice";
import { persistAuth } from "@/services/session";

type Pack = {
  key: string;
  tokens: number;
  bonusTokens?: number;
  totalTokens: number;
  cents: number;
  currency: string;
  shortLabel?: string;
  badge?: "popular" | "best";
};

type TxMeta = {
  kind?: string;
  receiverUsername?: string;
  cents?: number;
  packKey?: string;
  network?: string;
};

type TxRow = {
  id: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
  metadata?: TxMeta | null;
};

type CryptoIntent = {
  id: string;
  status: string;
  tokens: number;
  amountEur: number;
  network: string;
  walletAddress: string;
  reference: string;
};

type PayoutStatus = {
  tokenBalance: number;
  creatorBalance: number;
  pending: number;
  totalPaid: number;
  minPayout: number;
};

type PayoutRow = {
  id: string;
  amount: number;
  method: string;
  destination?: string | null;
  status: string;
  note?: string | null;
  createdAt: string;
  paidAt?: string | null;
};

function mapFallbackToPacks(): Pack[] {
  return FALLBACK_TOKEN_PACKS.map((p) => ({
    key: p.key,
    tokens: p.tokens,
    bonusTokens: p.bonusTokens,
    totalTokens: p.tokens + p.bonusTokens,
    cents: p.cents,
    currency: p.currency.toUpperCase(),
    shortLabel: p.shortLabel ?? undefined,
    badge: "badge" in p ? p.badge : undefined,
  }));
}

export function WalletClient() {
  const t = useTranslations("wallet");
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const paid = searchParams.get("paid") === "1";
  const cancel = searchParams.get("cancel") === "1";

  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);
  const user = useAppSelector((s) => s.auth.user);
  const balance = user?.balance ?? 0;
  const creatorBalance = user?.creatorBalance ?? 0;
  const isModel = user?.role === "MODEL";

  const [packs, setPacks] = useState<Pack[]>([]);
  const [packsFromFallback, setPacksFromFallback] = useState(false);
  const [tx, setTx] = useState<TxRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [cryptoPackKey, setCryptoPackKey] = useState("");
  const [cryptoNetwork, setCryptoNetwork] = useState("USDT_TRC20");
  const [cryptoIntent, setCryptoIntent] = useState<CryptoIntent | null>(null);
  const [cryptoBusy, setCryptoBusy] = useState(false);
  const [payoutStatus, setPayoutStatus] = useState<PayoutStatus | null>(null);
  const [payoutRows, setPayoutRows] = useState<PayoutRow[]>([]);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("bank");
  const [payoutDestination, setPayoutDestination] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [payoutBusy, setPayoutBusy] = useState(false);

  const sortedPacks = useMemo(() => {
    return [...packs].sort((a, b) => a.cents - b.cents);
  }, [packs]);

  useEffect(() => {
    if (!cryptoPackKey && sortedPacks[0]) {
      setCryptoPackKey(sortedPacks[0].key);
    }
  }, [cryptoPackKey, sortedPacks]);

  /** Miglior €/token sul listino (bonus inclusi) per stimare valorizzazione. */
  const bestBuyerEurPerToken = useMemo(() => {
    if (!sortedPacks.length) return null;
    let min = Infinity;
    for (const p of sortedPacks) {
      const tk = Math.max(1, p.totalTokens);
      const ept = (p.cents / 100) / tk;
      if (ept < min) min = ept;
    }
    return Number.isFinite(min) ? min : null;
  }, [sortedPacks]);

  const indicativeTopUpEuro = useMemo(() => {
    if (!balance || balance <= 0 || bestBuyerEurPerToken == null) return null;
    return balance * bestBuyerEurPerToken;
  }, [balance, bestBuyerEurPerToken]);

  const bestSellerEuroEstimate = useMemo(() => {
    if (!creatorBalance || creatorBalance <= 0 || !sortedPacks.length)
      return null;
    let min = Infinity;
    for (const p of sortedPacks) {
      const tk = Math.max(1, p.totalTokens);
      const ept = (p.cents / 100) / tk;
      if (ept < min) min = ept;
    }
    if (!Number.isFinite(min)) return null;
    return creatorBalance * min;
  }, [sortedPacks, creatorBalance]);

  const moneyFmt = useMemo(() => {
    return new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
  }, [locale]);

  function describeTxn(row: TxRow): string {
    const meta = row.metadata ?? {};
    if (row.method === "STRIPE" && row.amount > 0) return t("txnKindTopUp");
    if (row.method === "CRYPTO" && meta.kind === "CRYPTO_TOPUP_PENDING") {
      return t("txnKindCrypto", { network: meta.network ?? "crypto" });
    }
    if (row.method === "INTERNAL" && meta.kind === "TIP_OUT") {
      return t("txnKindTip", { user: meta.receiverUsername ?? "creator" });
    }
    return t("txnKindOther", { method: row.method });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchWithTimeout(apiUrl("/payments/token-packs"));
        if (!r.ok) throw new Error("bad_status");
        const d = (await r.json()) as { packs?: Pack[] };
        const list = (d.packs ?? []) as Pack[];
        if (cancelled) return;
        if (list.length > 0) {
          setPacksFromFallback(false);
          setPacks(
            list.map((p) => ({
              ...p,
              bonusTokens: p.bonusTokens ?? 0,
              totalTokens:
                typeof p.totalTokens === "number"
                  ? p.totalTokens
                  : p.tokens + (p.bonusTokens ?? 0),
              currency: (p.currency ?? "EUR").toUpperCase(),
            })),
          );
          return;
        }
      } catch {
        /* use fallback */
      }
      if (cancelled) return;
      setPacksFromFallback(true);
      setPacks(mapFallbackToPacks());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshTransactions = useCallback(() => {
    if (!token) return Promise.resolve();
    return apiFetch("/wallet/transactions")
      .then(async (r) => (r.ok ? r.json() : []))
      .then((rows: TxRow[]) => setTx(rows))
      .catch(() => setTx([]));
  }, [token]);

  const refreshPayouts = useCallback(() => {
    if (!token || !isModel) {
      setPayoutStatus(null);
      setPayoutRows([]);
      return Promise.resolve();
    }
    return Promise.all([
      apiFetch("/payouts/me/status").then(async (r) =>
        r.ok ? ((await r.json()) as PayoutStatus) : null,
      ),
      apiFetch("/payouts/me").then(async (r) =>
        r.ok ? ((await r.json()) as PayoutRow[]) : [],
      ),
    ])
      .then(([status, rows]) => {
        setPayoutStatus(status);
        setPayoutRows(rows);
      })
      .catch(() => {
        setPayoutStatus(null);
        setPayoutRows([]);
      });
  }, [token, isModel]);

  useEffect(() => {
    refreshTransactions();
  }, [refreshTransactions]);

  useEffect(() => {
    refreshPayouts();
  }, [refreshPayouts]);

  useEffect(() => {
    function onSync() {
      void refreshTransactions();
    }
    window.addEventListener("synthra:balance-sync", onSync);
    return () => window.removeEventListener("synthra:balance-sync", onSync);
  }, [refreshTransactions]);

  useEffect(() => {
    if (!paid || !token) return;
    let cancelled = false;
    (async () => {
      const res = await apiFetch("/users/me");
      if (!res.ok || cancelled) return;
      const u = await res.json();
      if (cancelled) return;
      dispatch(setCredentials({ token, user: u }));
      persistAuth(token, u);
      await refreshTransactions();
    })();
    return () => {
      cancelled = true;
    };
  }, [paid, token, dispatch, refreshTransactions]);

  async function requestCryptoIntent() {
    if (!cryptoPackKey) return;
    setMsg(null);
    setCryptoIntent(null);
    setCryptoBusy(true);
    try {
      const res = await apiFetch("/payments/crypto-intent", {
        method: "POST",
        body: JSON.stringify({
          packKey: cryptoPackKey,
          network: cryptoNetwork,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503) {
          setMsg(t("cryptoMissing"));
          return;
        }
        if (res.status === 401) {
          setMsg(t("needLoginBuy"));
          return;
        }
        setMsg(
          typeof data.message === "string" ? data.message : t("cryptoFail"),
        );
        return;
      }
      setCryptoIntent(data as CryptoIntent);
      await refreshTransactions();
    } finally {
      setCryptoBusy(false);
    }
  }

  async function requestPayout() {
    const amount = Number(payoutAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMsg(t("payoutInvalidAmount"));
      return;
    }
    setMsg(null);
    setPayoutBusy(true);
    try {
      const res = await apiFetch("/payouts", {
        method: "POST",
        body: JSON.stringify({
          amount: Math.floor(amount),
          method: payoutMethod,
          destination: payoutDestination,
          note: payoutNote,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(
          typeof data.message === "string" ? data.message : t("payoutFail"),
        );
        return;
      }
      setPayoutAmount("");
      setPayoutDestination("");
      setPayoutNote("");
      await refreshPayouts();
      setMsg(t("payoutCreated"));
    } finally {
      setPayoutBusy(false);
    }
  }

  function clearBanner() {
    router.replace("/wallet");
    setMsg(null);
  }

  async function buy(key: string) {
    setMsg(null);
    setBusyKey(key);
    try {
      const res = await apiFetch("/payments/checkout-session", {
        method: "POST",
        body: JSON.stringify({ packKey: key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503) {
          setMsg(t("revolutMissing"));
          return;
        }
        if (res.status === 401) {
          setMsg(t("needLoginBuy"));
          return;
        }
        setMsg(
          typeof data.message === "string" ? data.message : t("checkoutFail"),
        );
        return;
      }
      if (data.url) window.location.href = data.url as string;
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <AppShell>
      <div className="min-h-dvh bg-cam-bg">
        <div className="border-b border-cam-border bg-cam-ink/90">
          <div className="mx-auto max-w-[1240px] px-4 py-2.5 text-center text-[11px] leading-snug text-cam-muted sm:text-left">
            {t("trustStrip")}
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1240px] px-4 py-8 lg:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-cam-orange-bright">
                {t("kicker")}
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-cam-text sm:text-4xl">
                {t("title")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-cam-muted">
                {t("subtitle")}
              </p>
            </div>

          <div className="flex w-full shrink-0 flex-col gap-4 sm:max-w-sm">
            <div className="rounded-2xl border border-cam-orange/35 bg-gradient-to-br from-cam-card via-cam-ink to-cam-bg p-6 shadow-[0_0_48px_rgba(255,140,0,0.14)]">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-cam-muted">
                {t("balanceLabel")}
              </p>
              <p className="mt-1 text-4xl font-black tabular-nums tracking-tight text-cam-orange-bright">
                {token ? formatInteger(balance) : "—"}
              </p>
              <p className="mt-0.5 text-xs text-cam-muted">{t("tokenUnit")}</p>
              {indicativeTopUpEuro != null && balance > 0 && (
                <p className="mt-3 text-[11px] leading-snug text-cam-muted">
                  {t("indicativeEuroLine", {
                    eur: moneyFmt.format(indicativeTopUpEuro),
                  })}
                </p>
              )}
              <p className="mt-2 text-[10px] leading-snug text-cam-muted/90">
                {t("balanceSyncFootnote")}
              </p>
            </div>

            {token && isModel && (
              <div className="rounded-2xl border border-fuchsia-500/35 bg-gradient-to-br from-fuchsia-950/40 via-cam-ink to-cam-card p-5 shadow-inner">
                <p className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-200/95">
                  {t("creatorSaldoKicker")}
                </p>
                <p className="mt-3 text-[11px] font-semibold text-cam-muted">
                  {t("creatorSaldoTitle")}
                </p>
                <p className="mt-1 text-3xl font-black tabular-nums text-fuchsia-100">
                  {formatInteger(creatorBalance)}{" "}
                  <span className="text-base font-bold text-fuchsia-200/85">
                    {t("tokenUnit")}
                  </span>
                </p>
                {bestSellerEuroEstimate != null && creatorBalance > 0 && (
                  <p className="mt-2 text-[11px] text-fuchsia-200/80">
                    {t("indicativeEuroLine", {
                      eur: moneyFmt.format(bestSellerEuroEstimate),
                    })}
                  </p>
                )}
                <p className="mt-3 text-[11px] leading-relaxed text-cam-muted">
                  {t("creatorSaldoSubtitle")}
                </p>
                <Link
                  href="/studio"
                  className="mt-3 inline-flex text-[12px] font-bold text-fuchsia-200 underline underline-offset-2 hover:text-white"
                >
                  {t("creatorSaldoStudio")}
                </Link>
              </div>
            )}
          </div>
          </div>

          {paid && (
            <div className="mt-8 flex items-start justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
              <div>
                <strong>{t("paidSuccess")}</strong> {t("paidDetail")}
              </div>
              <button
                type="button"
                onClick={clearBanner}
                className="shrink-0 rounded-md px-2 py-0.5 text-emerald-300 hover:bg-white/10"
                aria-label={t("ariaCloseBanner")}
              >
                ✕
              </button>
            </div>
          )}

          {cancel && (
            <div className="mt-8 flex items-start justify-between gap-3 rounded-xl border border-amber-500/35 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
              <div>
                <strong>{t("cancelTitle")}</strong> {t("cancelDetail")}
              </div>
              <button
                type="button"
                onClick={clearBanner}
                className="shrink-0 rounded-md px-2 py-0.5 text-amber-200 hover:bg-white/10"
                aria-label={t("ariaCloseBanner")}
              >
                ✕
              </button>
            </div>
          )}

          {!token && (
            <p className="mt-8 rounded-xl border border-cam-border bg-cam-card/60 px-4 py-3 text-sm text-cam-text">
              {t("loginWall")}{" "}
              <Link
                href="/login"
                className="font-semibold text-cam-orange-bright hover:underline"
              >
                {t("loginLink")}
              </Link>{" "}
              /{" "}
              <Link
                href="/register"
                className="font-semibold text-cam-orange-bright hover:underline"
              >
                {t("registerLink")}
              </Link>
              .
            </p>
          )}

          {msg && (
            <p className="mt-6 rounded-xl border border-red-500/40 bg-red-950/35 px-4 py-3 text-sm text-red-100">
              {msg}
            </p>
          )}

          {packsFromFallback && (
            <div className="mt-6 rounded-xl border border-cam-orange/30 bg-cam-orange/10 px-4 py-3 text-[13px] leading-relaxed text-cam-text">
              {t("fallbackBanner")}
            </div>
          )}

          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_minmax(280px,360px)] lg:gap-12">
            <section>
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-cam-text">
                {t("buySectionTitle")}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-cam-muted">
                {t("buySectionHint")}
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {sortedPacks.map((p) => {
                  const total = p.totalTokens;
                  const bonus = p.bonusTokens ?? 0;
                  const eurAmount = p.cents / 100;
                  const perTok =
                    total > 0
                      ? t("perToken", {
                          price: moneyFmt.format(eurAmount / total),
                        })
                      : "";
                  const isBest = p.badge === "best";
                  const isPop = p.badge === "popular";
                  return (
                    <div
                      key={p.key}
                      className={`relative flex flex-col rounded-xl border bg-cam-card p-5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] transition hover:border-cam-orange/50 ${
                        isBest
                          ? "border-cam-orange ring-2 ring-cam-orange/50"
                          : isPop
                            ? "border-cam-orange/70 ring-1 ring-cam-orange/35"
                            : "border-cam-border"
                      }`}
                    >
                      {(isPop || isBest) && (
                        <span
                          className={`absolute -top-2.5 right-4 rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cam-ink ${
                            isBest ? "bg-cam-orange-bright" : "bg-cam-orange"
                          }`}
                        >
                          {isBest ? t("badgeBest") : t("badgePopular")}
                        </span>
                      )}
                      <p className="text-[10px] font-bold uppercase tracking-wider text-cam-muted">
                        {p.shortLabel || t("packFallback")}
                      </p>
                      <p className="mt-2 text-3xl font-black tabular-nums text-cam-text">
                        {formatInteger(total)}
                        <span className="ml-1.5 text-base font-bold text-cam-orange-bright">
                          {t("tokenUnit")}
                        </span>
                      </p>
                      {bonus > 0 ? (
                        <p className="mt-1.5 text-[12px] font-medium text-emerald-400/95">
                          {t("bonusLine", {
                            bonus: formatInteger(bonus),
                            base: formatInteger(p.tokens),
                          })}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-[12px] text-cam-muted">
                          {t("noBonus", { count: formatInteger(p.tokens) })}
                        </p>
                      )}
                      <p className="mt-4 text-2xl font-bold tabular-nums text-cam-text">
                        {moneyFmt.format(eurAmount)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-cam-muted">
                        {perTok}
                      </p>
                      <button
                        type="button"
                        onClick={() => buy(p.key)}
                        disabled={!token || busyKey === p.key}
                        className="btn-tip mt-5 w-full py-2.5 text-xs"
                      >
                        {busyKey === p.key ? t("buyLoading") : t("buy")}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 rounded-xl border border-cam-border bg-cam-ink/75 p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-cam-orange-bright">
                      {t("cryptoTitle")}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cam-muted">
                      {t("cryptoBody")}
                    </p>
                  </div>
                  <span className="rounded-full border border-cam-orange/35 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cam-orange-bright">
                    {t("cryptoManualBadge")}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_160px_auto]">
                  <label className="text-xs font-semibold text-cam-muted">
                    {t("cryptoPackLabel")}
                    <select
                      value={cryptoPackKey}
                      onChange={(e) => setCryptoPackKey(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-cam-border bg-cam-bg px-3 py-2 text-sm text-cam-text outline-none focus:border-cam-orange"
                    >
                      {sortedPacks.map((p) => (
                        <option key={p.key} value={p.key}>
                          {formatInteger(p.totalTokens)} {t("tokenUnit")} ·{" "}
                          {moneyFmt.format(p.cents / 100)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-cam-muted">
                    {t("cryptoNetworkLabel")}
                    <select
                      value={cryptoNetwork}
                      onChange={(e) => setCryptoNetwork(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-cam-border bg-cam-bg px-3 py-2 text-sm text-cam-text outline-none focus:border-cam-orange"
                    >
                      <option value="USDT_TRC20">USDT TRC20</option>
                      <option value="USDT_ERC20">USDT ERC20</option>
                      <option value="BTC">BTC</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={requestCryptoIntent}
                    disabled={!token || cryptoBusy || !cryptoPackKey}
                    className="btn-secondary self-end px-4 py-2.5 text-xs"
                  >
                    {cryptoBusy ? t("cryptoLoading") : t("cryptoCreate")}
                  </button>
                </div>

                {cryptoIntent && (
                  <div className="mt-5 rounded-lg border border-emerald-500/35 bg-emerald-950/30 p-4 text-sm text-emerald-100">
                    <p className="font-bold">
                      {t("cryptoIntentTitle", {
                        amount: formatInteger(cryptoIntent.tokens),
                      })}
                    </p>
                    <p className="mt-2 break-all text-xs">
                      {t("cryptoAddress")}: {cryptoIntent.walletAddress}
                    </p>
                    <p className="mt-1 text-xs">
                      {t("cryptoReference")}: {cryptoIntent.reference}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-emerald-100/80">
                      {t("cryptoInstructions")}
                    </p>
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-6 lg:sticky lg:top-6">
              <div className="rounded-xl border border-cam-border bg-cam-ink/80 p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cam-orange-bright">
                  {t("asideTokensTitle")}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-cam-muted">
                  {t("asideTokensBody")}
                </p>
                <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-cam-text">
                  {t("asideUseTitle")}
                </h3>
                <ul className="mt-3 space-y-2 border-t border-cam-border pt-4 text-sm text-cam-text">
                  <li className="flex gap-2">
                    <span className="text-cam-orange">✓</span>
                    <span>{t("useTip")}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-cam-orange">✓</span>
                    <span>{t("usePrivate")}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-cam-orange">✓</span>
                    <span>{t("useTicket")}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-cam-orange">✓</span>
                    <span>{t("useGallery")}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-cam-orange">✓</span>
                    <span>{t("useDiscover")}</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-cam-border bg-cam-card p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cam-text">
                  {t("paymentsTitle")}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-cam-muted">
                  {t("paymentsBody")}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide text-cam-muted">
                  <span className="rounded border border-cam-border px-2 py-1">
                    Stripe
                  </span>
                  <span className="rounded border border-cam-border px-2 py-1">
                    Visa
                  </span>
                  <span className="rounded border border-cam-border px-2 py-1">
                    Mastercard
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Link
                  href="/discover"
                  className="rounded-xl border border-cam-border bg-cam-ink px-4 py-3 text-center text-sm font-semibold text-cam-text transition hover:border-cam-orange/50 hover:text-cam-orange-bright"
                >
                  {t("linkDiscover")}
                </Link>
                <Link
                  href="/"
                  className="rounded-xl border border-cam-border bg-transparent px-4 py-3 text-center text-sm text-cam-muted transition hover:border-cam-border hover:text-cam-text"
                >
                  {t("linkHome")}
                </Link>
              </div>

              <p className="text-[11px] leading-relaxed text-cam-muted">
                {t("legalNote")}
              </p>
            </aside>
          </div>

          {token && isModel && (
            <section className="mt-14 border-t border-cam-border pt-10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-cam-text">
                    {t("payoutTitle")}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cam-muted">
                    {t("payoutBody")}
                  </p>
                </div>
                {payoutStatus && (
                  <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/25 px-4 py-3 text-right text-xs text-fuchsia-100">
                    <p>
                      {t("payoutAvailable")}:{" "}
                      <strong>{formatInteger(payoutStatus.creatorBalance)}</strong>
                    </p>
                    <p className="mt-1 text-fuchsia-100/75">
                      {t("payoutPending")}: {formatInteger(payoutStatus.pending)}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
                <div className="rounded-xl border border-cam-border bg-cam-card p-5">
                  <label className="block text-xs font-semibold text-cam-muted">
                    {t("payoutAmount")}
                    <input
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      inputMode="numeric"
                      placeholder={String(payoutStatus?.minPayout ?? 1000)}
                      className="mt-1 w-full rounded-lg border border-cam-border bg-cam-bg px-3 py-2 text-sm text-cam-text outline-none focus:border-cam-orange"
                    />
                  </label>
                  <label className="mt-3 block text-xs font-semibold text-cam-muted">
                    {t("payoutMethod")}
                    <select
                      value={payoutMethod}
                      onChange={(e) => setPayoutMethod(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-cam-border bg-cam-bg px-3 py-2 text-sm text-cam-text outline-none focus:border-cam-orange"
                    >
                      <option value="bank">Bank / IBAN</option>
                      <option value="paypal">PayPal</option>
                      <option value="stripe_connect">Stripe Connect</option>
                      <option value="crypto">Crypto</option>
                    </select>
                  </label>
                  <label className="mt-3 block text-xs font-semibold text-cam-muted">
                    {t("payoutDestination")}
                    <input
                      value={payoutDestination}
                      onChange={(e) => setPayoutDestination(e.target.value)}
                      placeholder={t("payoutDestinationPlaceholder")}
                      className="mt-1 w-full rounded-lg border border-cam-border bg-cam-bg px-3 py-2 text-sm text-cam-text outline-none focus:border-cam-orange"
                    />
                  </label>
                  <label className="mt-3 block text-xs font-semibold text-cam-muted">
                    {t("payoutNote")}
                    <textarea
                      value={payoutNote}
                      onChange={(e) => setPayoutNote(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-lg border border-cam-border bg-cam-bg px-3 py-2 text-sm text-cam-text outline-none focus:border-cam-orange"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={requestPayout}
                    disabled={payoutBusy}
                    className="btn-tip mt-4 w-full py-2.5 text-xs"
                  >
                    {payoutBusy ? t("payoutLoading") : t("payoutSubmit")}
                  </button>
                  <p className="mt-3 text-[11px] leading-relaxed text-cam-muted">
                    {t("payoutMin", {
                      amount: formatInteger(payoutStatus?.minPayout ?? 1000),
                    })}
                  </p>
                </div>

                <div>
                  {!payoutRows.length ? (
                    <p className="rounded-xl border border-cam-border bg-cam-ink/70 px-4 py-3 text-sm text-cam-muted">
                      {t("payoutEmpty")}
                    </p>
                  ) : (
                    <ul className="divide-y divide-cam-border overflow-hidden rounded-xl border border-cam-border bg-cam-card">
                      {payoutRows.map((row) => (
                        <li key={row.id} className="px-4 py-3 text-sm text-cam-text">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold text-fuchsia-100">
                              {formatInteger(row.amount)} {t("tokenUnit")}
                            </span>
                            <span className="rounded-md bg-cam-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cam-muted">
                              {row.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-cam-muted">
                            {row.method} · {formatIsoUtc(row.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          )}

          <section className="mt-14 border-t border-cam-border pt-10">
            <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-cam-text">
              {t("txnTitle")}
            </h2>
            {!tx.length ? (
              <p className="mt-4 text-sm text-cam-muted">
                {token ? t("txnEmpty") : t("txnLogin")}
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-cam-border overflow-hidden rounded-xl border border-cam-border bg-cam-card shadow-[0_8px_28px_rgba(0,0,0,0.35)]">
                {tx.map((row) => {
                  const amtKey =
                    row.amount >= 0
                      ? t("txnCredit", {
                          amount: formatInteger(row.amount),
                        })
                      : t("txnDebit", {
                          amount: formatInteger(Math.abs(row.amount)),
                        });
                  return (
                    <li
                      key={row.id}
                      className="flex flex-col gap-2 px-4 py-3 text-sm text-cam-text"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={
                            row.amount < 0
                              ? "font-bold text-rose-300/95"
                              : "font-bold text-emerald-300/95"
                          }
                        >
                          {amtKey}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            row.status === "COMPLETED"
                              ? "bg-emerald-900/50 text-emerald-200"
                              : row.status === "FAILED" ||
                                  row.status === "REFUNDED"
                                ? "bg-red-900/45 text-red-200"
                                : "bg-cam-ink text-cam-muted"
                          }`}
                        >
                          {row.status}
                        </span>
                      </div>
                      <p className="text-[13px] text-cam-text">{describeTxn(row)}</p>
                      <span className="text-[11px] text-cam-muted">
                        {formatIsoUtc(row.createdAt)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
