import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { WalletClient } from "./wallet-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("walletTitle"),
  };
}

export default async function WalletPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "wallet" });

  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-cam-bg px-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-cam-border border-t-cam-orange" />
          <p className="text-sm text-cam-muted">{t("loading")}</p>
        </div>
      }
    >
      <WalletClient />
    </Suspense>
  );
}
