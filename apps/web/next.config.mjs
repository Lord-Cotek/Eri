/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Runs instrumentation.ts at server start, which validates required
    // configuration and refuses to boot without it.
    instrumentationHook: true,
  },
  eslint: {
    // Lint is a separate step (`npm run lint`); a lint warning should not fail
    // the typecheck build that acceptance criterion 9 turns on.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/api/v1/sentinel/:path*",
        headers: [
          // Sentinels are native clients and the simulator. No browser origin
          // has any business calling these, and none of them need caching.
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
