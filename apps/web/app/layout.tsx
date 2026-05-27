import type { Metadata, Viewport } from "next";
import "./globals.css";
import { routing } from "@/i18n/routing";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: {
    default: "Synthra — Live streaming",
    template: "%s | Synthra",
  },
  description: "Synthra: live streaming, creator, chat e token.",
  manifest: "/manifest.json",
  applicationName: "Synthra",
  icons: {
    icon: "/icons/icon.svg",
    shortcut: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Synthra",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#19191c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

/**
 * Unico `<html>` / `<body>`. Font da variabili in `globals.css` (niente Google Fonts in dev).
 * `HtmlLang` sotto next-intl aggiorna `lang` su /en ecc.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={routing.defaultLocale} suppressHydrationWarning>
      <body className="min-h-dvh bg-cam-bg font-sans text-cam-text antialiased">
        {children}
      </body>
    </html>
  );
}
