import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ['192.168.5.*', '**.168.5.*'],
};

export default nextConfig;
