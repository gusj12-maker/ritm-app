import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  basePath: '/ritm-app',
  trailingSlash: true,
};

export default nextConfig;