import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    proxyTimeout: 180000,
  },
  async rewrites() {
    return {
      fallback: [
        {
          source: '/api/:path*',
          destination: `${process.env.API_URL || 'http://127.0.0.1:8000'}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
