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
  images: {
    // Allow next/image to fetch + optimise course thumbnails / cover
    // images / avatars served from Supabase Storage. Without this,
    // <Image> renders silently broken because the host isn't on the
    // allowlist.
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      // Mux still serves video thumbnails through image.mux.com when
      // we surface them in the UI later.
      { protocol: 'https', hostname: 'image.mux.com' },
    ],
  },
};

export default nextConfig;
