import { getRequestConfig } from "next-intl/server";
import enMessages from "../messages/en.json";
import itMessages from "../messages/it.json";
import { routing } from "./routing";

const catalogs = {
  it: itMessages,
  en: enMessages,
} as const;

export default getRequestConfig(async ({ requestLocale }) => {
  try {
    let locale = await requestLocale;
    if (
      !locale ||
      !routing.locales.includes(locale as (typeof routing.locales)[number])
    ) {
      locale = routing.defaultLocale;
    }

    const messages = locale === "en" ? catalogs.en : catalogs.it;

    return {
      locale,
      messages,
      timeZone: "Europe/Rome",
    };
  } catch (e) {
    console.error("[next-intl] getRequestConfig failed, using default IT catalog:", e);
    return {
      locale: routing.defaultLocale,
      messages: catalogs.it,
      timeZone: "Europe/Rome",
    };
  }
});
