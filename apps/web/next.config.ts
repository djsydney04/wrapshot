import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/database"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
