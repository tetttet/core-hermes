import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack scoped to this app even if another lockfile is added above it.
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // Next 16.2 can spin indefinitely after restoring a corrupted dev cache.
    turbopackFileSystemCacheForDev: false,
    viewTransition: true,
  },
};

export default nextConfig;
