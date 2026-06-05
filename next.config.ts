import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Cloudinary como único origen de imágenes (más espacio gratuito que R2).
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "xjalihfqzitkxlskxyih.supabase.co" },
    ],
  },
  experimental: {
    // Server Actions: límite de tamaño para subidas de imágenes desde el admin.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
