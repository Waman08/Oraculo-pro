/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/analyze/:path*',
        destination: '/api/',
      },
      {
        source: '/api/screener/:path*',
        destination: '/api/',
      },
      {
        source: '/api/onchain/:path*',
        destination: '/api/',
      },
      {
        source: '/api/user/:path*',
        destination: '/api/',
      },
      {
        source: '/api/telegram/:path*',
        destination: '/api/',
      },
    ];
  },
};

module.exports = nextConfig;
