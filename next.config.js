/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const pythonApiUrl = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000';
    return [
      { source: '/api/analyze/:path*', destination: `${pythonApiUrl}/api/analyze/:path*` },
      { source: '/api/screener/:path*', destination: `${pythonApiUrl}/api/screener/:path*` },
      { source: '/api/onchain/:path*', destination: `${pythonApiUrl}/api/onchain/:path*` },
      { source: '/api/supply/:path*', destination: `${pythonApiUrl}/api/supply/:path*` },
      { source: '/api/stablecoins/:path*', destination: `${pythonApiUrl}/api/stablecoins/:path*` },
      { source: '/api/backtest/:path*', destination: `${pythonApiUrl}/api/backtest/:path*` },
      { source: '/api/telegram/:path*', destination: `${pythonApiUrl}/api/telegram/:path*` },
      { source: '/api/user/:path*', destination: `${pythonApiUrl}/api/user/:path*` },
    ];
  },
};

module.exports = nextConfig;
