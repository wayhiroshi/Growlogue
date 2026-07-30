import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedEnv: true
  },
  transpilePackages: [
    "@growlogue/content",
    "@growlogue/db",
    "@growlogue/domain",
    "@growlogue/life-unlocks",
    "@growlogue/reports"
  ],
  async rewrites() {
    return [
      {
        source: "/api/v1/wishes",
        destination: "/api/v1/wishes/_root"
      },
      {
        source: "/api/v1/reports/weekly",
        destination: "/api/v1/wishes/_weekly-report"
      },
      {
        source: "/api/v1/share-cards",
        destination: "/api/v1/wishes/_share-cards"
      },
      {
        source: "/api/v1/share-cards/:id/revoke",
        destination: "/api/v1/wishes/_share-cards/:id/revoke"
      },
      {
        source: "/share/:token/image",
        destination: "/api/v1/wishes/_public-share/:token/image"
      },
      {
        source: "/share/:token",
        destination: "/api/v1/wishes/_public-share/:token"
      }
    ];
  }
};

export default nextConfig;
