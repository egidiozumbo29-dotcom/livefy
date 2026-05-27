import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Immagine Docker + tracing corretto in monorepo (vedi deploy/Dockerfile.web). */
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
  /** Stesso host del browser → niente CORS e niente `localhost:4000` da altri dispositivi. */
  async rewrites() {
    const origin =
      process.env.API_INTERNAL_ORIGIN?.trim().replace(/\/$/, "") ||
      "http://127.0.0.1:4000";
    return [
      {
        source: "/_nestjs/:path*",
        destination: `${origin}/api/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
