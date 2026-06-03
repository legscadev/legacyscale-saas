import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Course thumbnails + lesson resources are uploaded through
      // Server Actions. Matches the per-feature caps we enforce in
      // the action handlers themselves.
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
