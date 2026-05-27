"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export function LocaleSwitcher() {
  const t = useTranslations("localeSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <label className="flex items-center gap-1.5 text-xs text-cam-muted">
      <span className="sr-only">{t("ariaLabel")}</span>
      <select
        aria-label={t("ariaLabel")}
        value={locale}
        onChange={(e) =>
          router.replace(pathname, { locale: e.target.value as "it" | "en" })
        }
        className="cursor-pointer rounded border border-cam-border bg-cam-card px-2 py-1 font-medium text-cam-text focus:border-cam-orange focus:outline-none focus:ring-1 focus:ring-cam-orange"
      >
        {routing.locales.map((code) => (
          <option key={code} value={code}>
            {code.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
}
