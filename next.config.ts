import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/ritm-app',
  assetPrefix: '/ritm-app/',
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;