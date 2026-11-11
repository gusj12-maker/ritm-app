import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  basePath: '/ritm-app', // Точное название твоего репозитория
  assetPrefix: '/ritm-app/',
};

export default nextConfig;