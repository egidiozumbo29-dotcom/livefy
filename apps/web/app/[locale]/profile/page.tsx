"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { apiFetch, apiUrl } from "@/services/api";
import { useAppSelector } from "@/store/hooks";
import { formatInteger } from "@/lib/format";
import {
  PROFILE_SOCIAL_KEYS,
  emptySocialLinksForm,
  normalizeLangList,
  type ProfileSocialKey,
} from "@/lib/social-profile";

type ProfilePayload = {
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  category: string;
  language: string;
  /** Lingue aggiuntive oltre la principale */
  languagesExtra: string;
  country: string;
  tags: string;
  social: Record<ProfileSocialKey, string>;
};

const emptyPayload: ProfilePayload = {
  bio: "",
  avatarUrl: "",
  bannerUrl: "",
  category: "",
  language: "",
  languagesExtra: "",
  country: "",
  tags: "",
  social: emptySocialLinksForm(),
};

export default function ProfilePage() {
  const tStreamer = useTranslations("becomeStreamer");
  const tCre = useTranslations("creatorProfile");
  const tSoc = useTranslations("creatorProfile.socialBrand");
  const token = useAppSelector((s) => s.auth.token);
  const user = useAppSelector((s) => s.auth.user);
  const [form, setForm] = useState<ProfilePayload>(emptyPayload);
  const [followers, setFollowers] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !user?.id) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      apiFetch("/users/me").then((r) => (r.ok ? r.json() : null)),
      fetch(apiUrl(`/follow/counts/${user.id}`))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])
      .then(([u, counts]) => {
        if (cancelled) return;
        if (u) {
          const nextSocial = emptySocialLinksForm();
          const links = u.socialLinks;
          if (links && typeof links === "object" && !Array.isArray(links)) {
            const o = links as Record<string, unknown>;
            for (const k of PROFILE_SOCIAL_KEYS) {
              const v = o[k];
              if (typeof v === "string") nextSocial[k] = v;
            }
          }
          setForm({
            bio: u.bio ?? "",
            avatarUrl: u.avatarUrl ?? "",
            bannerUrl: u.bannerUrl ?? "",
            category: u.category ?? "",
            language: u.language ?? "",
            languagesExtra: Array.isArray(u.languages)
              ? u.languages.join(", ")
              : "",
            country: u.country ?? "",
            tags: Array.isArray(u.tags) ? u.tags.join(", ") : "",
            social: nextSocial,
          });
        }
        if (counts && typeof counts.followers === "number") {
          setFollowers(counts.followers);
        }
      })
      .catch(() => setMsg("Non riesco a caricare il profilo."))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, user?.id]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const body = {
        bio: form.bio,
        avatarUrl: form.avatarUrl,
        bannerUrl: form.bannerUrl,
        category: form.category,
        language: form.language,
        languages: normalizeLangList(form.languagesExtra),
        country: form.country,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 40),
        socialLinks: Object.fromEntries(
          PROFILE_SOCIAL_KEYS.map((k) => [k, form.social[k]?.trim() ?? ""]),
        ),
      };
      const res = await apiFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMsg(typeof data.message === "string" ? data.message : "Salvataggio fallito.");
        return;
      }
      setMsg("Profilo salvato.");
    } finally {
      setSaving(false);
    }
  }

  if (!token) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md px-4 py-10 lg:px-6">
          <h1 className="text-2xl font-bold text-cam-text">Profilo</h1>
          <p className="mt-3 rounded-md border border-cam-border bg-cam-card px-4 py-3 text-sm text-cam-text">
            Devi prima{" "}
            <Link href="/login" className="font-semibold text-cam-orange-bright hover:underline">
              accedere
            </Link>
            .
          </p>
        </div>
      </AppShell>
    );
  }

  const banner =
    form.bannerUrl ||
    `https://picsum.photos/seed/${encodeURIComponent(user?.id ?? "me")}-banner/1600/400`;
  const avatar =
    form.avatarUrl ||
    `https://picsum.photos/seed/${encodeURIComponent(user?.id ?? "me")}/160/160`;

  const langsMerged = [...new Set([
    ...(form.language.trim() ? [form.language.trim()] : []),
    ...normalizeLangList(form.languagesExtra),
  ])];

  const isCreator = user?.role === "MODEL" || user?.role === "ADMIN";

  const inputCls =
    "mt-1 w-full rounded-md border border-cam-border bg-cam-ink px-3 py-2 text-sm text-cam-text placeholder:text-cam-muted focus:border-cam-orange focus:outline-none focus:ring-2 focus:ring-cam-orange/35";
  const labelCls = "block text-xs font-semibold uppercase tracking-wider text-cam-muted";

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1100px] pb-10">
        <div className="relative h-44 overflow-hidden bg-cam-ink sm:h-56">
          <Image
            src={banner}
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
            unoptimized
          />
        </div>

        <div className="px-4 lg:px-6">
          <header className="-mt-12 flex flex-wrap items-end gap-4 sm:-mt-16">
            <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-cam-bg bg-cam-card shadow sm:h-28 sm:w-28">
              <Image
                src={avatar}
                alt={user?.username ?? "me"}
                fill
                sizes="120px"
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-cam-text">
                {user?.username}
              </h1>
              <p className="mt-1 text-xs text-cam-muted">
                {user?.role}
                {form.category ? ` · ${form.category}` : ""}
                {form.country ? ` · ${form.country}` : ""}
              </p>
              {langsMerged.length > 0 ? (
                <p className="mt-2 text-[11px] text-cam-muted">
                  {tCre("languagesHeading")}: {langsMerged.join(" · ")}
                </p>
              ) : null}
              <p className="mt-2 flex flex-wrap gap-3 text-xs text-cam-text">
                <span>
                  <strong className="tabular-nums text-cam-text">
                    {followers != null ? formatInteger(followers) : "—"}
                  </strong>{" "}
                  follower
                </span>
                <span>
                  <strong className="tabular-nums text-cam-orange-bright">
                    {formatInteger(user?.balance ?? 0)}
                  </strong>{" "}
                  token
                </span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/u/${user?.id}`}
                className="rounded-full border border-cam-border px-4 py-2 text-xs font-semibold text-cam-muted hover:border-cam-orange hover:text-cam-orange-bright"
              >
                Vedi profilo pubblico
              </Link>
              {user?.role === "VIEWER" && (
                <Link
                  href="/become-streamer"
                  className="rounded-full border border-cam-orange/50 bg-cam-ink px-4 py-2 text-xs font-bold uppercase tracking-wide text-cam-orange-bright hover:border-cam-orange"
                >
                  {tStreamer("profileCta")}
                </Link>
              )}
              {isCreator && (
                <Link
                  href="/studio"
                  className="rounded-full bg-cam-cta px-4 py-2 text-xs font-bold uppercase tracking-wide text-cam-ink shadow"
                >
                  Apri Studio
                </Link>
              )}
            </div>
          </header>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <form
              onSubmit={saveProfile}
              className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card"
            >
              <h2 className="text-sm font-bold uppercase tracking-wider text-cam-muted">
                Informazioni
              </h2>

              <label className={`mt-4 ${labelCls}`}>
                Bio
                <textarea
                  value={form.bio}
                  onChange={(e) =>
                    setForm((v) => ({ ...v, bio: e.target.value }))
                  }
                  rows={4}
                  placeholder="Racconta chi sei, cosa fai in live..."
                  className={inputCls}
                />
              </label>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className={labelCls}>
                  Avatar URL
                  <input
                    type="url"
                    value={form.avatarUrl}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, avatarUrl: e.target.value }))
                    }
                    className={inputCls}
                  />
                </label>
                <label className={labelCls}>
                  Banner URL
                  <input
                    type="url"
                    value={form.bannerUrl}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, bannerUrl: e.target.value }))
                    }
                    className={inputCls}
                  />
                </label>
                <label className={labelCls}>
                  Categoria
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, category: e.target.value }))
                    }
                    className={inputCls}
                  />
                </label>
                <label className={labelCls}>
                  {tCre("primaryLanguage")}
                  <input
                    type="text"
                    value={form.language}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, language: e.target.value }))
                    }
                    className={inputCls}
                  />
                </label>
                <label className={`sm:col-span-2 ${labelCls}`}>
                  {tCre("languagesHeading")}{" "}
                  <span className="font-normal normal-case text-[10px] text-cam-muted">
                    ({tCre("extraLanguagesHint")})
                  </span>
                  <input
                    type="text"
                    value={form.languagesExtra}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, languagesExtra: e.target.value }))
                    }
                    placeholder="en, es, fr"
                    className={inputCls}
                  />
                </label>
                <label className={labelCls}>
                  Paese
                  <input
                    type="text"
                    value={form.country}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, country: e.target.value }))
                    }
                    className={inputCls}
                  />
                </label>
                <label className={labelCls}>
                  Tag (separati da virgola)
                  <input
                    type="text"
                    value={form.tags}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, tags: e.target.value }))
                    }
                    className={inputCls}
                  />
                </label>
              </div>

            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cam-muted">
                {tCre("socialHeading")}
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {PROFILE_SOCIAL_KEYS.map((key) => (
                  <label key={key} className={labelCls}>
                    {tSoc(key)}
                    <input
                      type="url"
                      value={form.social[key]}
                      onChange={(e) =>
                        setForm((v) => ({
                          ...v,
                          social: { ...v.social, [key]: e.target.value },
                        }))
                      }
                      placeholder="https://"
                      className={inputCls}
                    />
                  </label>
                ))}
              </div>
            </div>

              {msg && (
                <p className="mt-4 rounded-md bg-cam-ink px-3 py-2 text-xs text-cam-muted">
                  {msg}
                </p>
              )}

              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={saving || loading}
                  className="rounded-full bg-cam-cta px-4 py-2 text-sm font-bold uppercase tracking-wide text-cam-ink shadow disabled:opacity-50"
                >
                  {saving ? "Salvo..." : loading ? "Carico..." : "Salva profilo"}
                </button>
              </div>
            </form>

            <aside className="space-y-4">
              <div className="rounded-md border border-cam-border bg-cam-card p-5 shadow-card">
                <h2 className="text-sm font-bold uppercase tracking-wider text-cam-muted">
                  Account
                </h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-cam-muted">Email</dt>
                    <dd className="truncate text-cam-text">{user?.email}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-cam-muted">Ruolo</dt>
                    <dd className="text-cam-text">{user?.role}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-cam-muted">Balance</dt>
                    <dd className="tabular-nums font-bold text-cam-orange-bright">
                      {formatInteger(user?.balance ?? 0)} tk
                    </dd>
                  </div>
                </dl>
                <Link
                  href="/wallet"
                  className="mt-4 inline-block rounded-full border border-cam-border px-3 py-1.5 text-xs font-semibold text-cam-muted hover:border-cam-orange hover:text-cam-orange-bright"
                >
                  Apri wallet
                </Link>
              </div>

              {isCreator && (
                <div className="rounded-md border border-cam-orange/40 bg-cam-orange/10 p-5">
                  <h2 className="text-sm font-bold text-cam-orange-bright">
                    Sei una creator
                  </h2>
                  <p className="mt-2 text-xs text-cam-muted">
                    Apri lo Studio per gestire la tua live, modalita show, prezzi
                    e tip menu.
                  </p>
                  <Link
                    href="/studio"
                    className="mt-4 inline-block rounded-full bg-cam-cta px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-cam-ink"
                  >
                    Vai allo Studio
                  </Link>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
