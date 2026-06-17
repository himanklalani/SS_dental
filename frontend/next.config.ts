import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `https://review-booking-system.onrender.com/api/:path*`, // Proxy strictly to Backend
      },
    ];
  },
};

export default nextConfig;
