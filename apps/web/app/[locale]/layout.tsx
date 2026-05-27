import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { HtmlLang } from "@/components/i18n/HtmlLang";
import { routing } from "@/i18n/routing";
import enCatalog from "@/messages/en.json";
import itCatalog from "@/messages/it.json";
import { Providers } from "../providers";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);
  /** Cataloghi statici: evita 500 da `getMessages` diverso fra build/hosting. */
  const messages = locale === "en" ? enCatalog : itCatalog;

  return (
    <NextIntlClientProvider messages={messages}>
      <HtmlLang />
      <Providers>{children}</Providers>
    </NextIntlClientProvider>
  );
}
