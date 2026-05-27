"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useAppSelector } from "@/store/hooks";
import { useEffect, useState } from "react";

export function MobileTabBar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const user = useAppSelector((s) => s.auth.user);
  const [clientAuthReady, setClientAuthReady] = useState(false);
  const authUser = clientAuthReady ? user : null;
  useEffect(() => {
    setClientAuthReady(true);
  }, []);
  const baseTabs = [
    { href: "/", label: t("live") },
    { href: "/discover", label: t("discover") },
    { href: "/messages", label: t("messagesShort") },
    { href: "/wallet", label: t("tokens") },
    { href: "/profile", label: t("profile") },
  ] as const;
  const roleTab =
    authUser?.role === "ADMIN"
      ? { href: "/admin/payouts", label: "Admin" }
      : authUser?.role === "MODERATOR"
        ? { href: "/studio", label: "Mod" }
        : authUser?.role === "MODEL"
          ? { href: "/studio", label: t("studio") }
          : null;
  const tabs =
    roleTab ? [...baseTabs, roleTab] : baseTabs;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-cam-border bg-cam-ink/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.55)] backdrop-blur supports-[padding:max(0px)]:px-[max(0px,env(safe-area-inset-left))] lg:hidden"
      aria-label={t("mainNavAria")}
    >
      {tabs.map(({ href, label }) => {
        const active =
          href === "/"
            ? pathname === "/" || pathname === ""
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex min-h-[3.5rem] flex-1 flex-col items-center justify-center px-1 py-2 text-[11px] font-semibold transition active:scale-[0.98] ${
              active ? "text-cam-orange-bright" : "text-cam-muted hover:text-cam-text"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
