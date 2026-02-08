import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'clawhive.com',
          },
        ],
        destination: 'https://moltswarm.com/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.clawhive.com',
          },
        ],
        destination: 'https://moltswarm.com/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
