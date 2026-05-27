"use client";

import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/AppShell";

type AuthScreenProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

/**
 * Layout unificato per login / registrazione (stessa gerarchia visiva, kicker brand, card form).
 */
export function AuthScreen({ title, subtitle, children }: AuthScreenProps) {
  const t = useTranslations("authLayout");

  return (
    <AppShell>
      <div className="relative mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-10 lg:px-6">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cam-orange/60 to-transparent"
          aria-hidden
        />
        <header className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-cam-orange-bright">
            {t("brand")}
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-cam-muted">
            {t("kicker")}
          </p>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-cam-text">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-cam-muted">{subtitle}</p>
        </header>
        {children}
      </div>
    </AppShell>
  );
}
