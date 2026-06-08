import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Course thumbnails + lesson resources are uploaded through
      // Server Actions. Cap is the per-feature limit (10 MB for
      // thumbnails) plus headroom for multipart overhead so the body
      // limit doesn't fire before our nicer field-level validation.
      bodySizeLimit: '12mb',
    },
  },
};

export default nextConfig;
