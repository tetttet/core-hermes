import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Keep Turbopack scoped to this app even if another lockfile is added above it.
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // Next 16.2 can spin indefinitely after restoring a corrupted dev cache.
    turbopackFileSystemCacheForDev: false,
    // Required by next-intl's Next.js 16.2 root locale parameter integration.
    rootParams: true,
    viewTransition: true,
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
