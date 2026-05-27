"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";

/** Allinea `document.documentElement.lang` alla locale effettiva di next-intl (dopo i provider). */
export function HtmlLang() {
  const locale = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
