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
    "@growlogue/life-unlocks"
  ],
  async rewrites() {
    return [
      {
        source: "/api/v1/wishes",
        destination: "/api/v1/wishes/_root"
      }
    ];
  }
};

export default nextConfig;
