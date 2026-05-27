import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["it", "en"],
  defaultLocale: "it",
  /** Italiano senza prefisso URL (`/`), altre lingue con `/en`, … */
  localePrefix: "as-needed",
});
