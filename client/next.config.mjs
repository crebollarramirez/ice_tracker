import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.js");

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Enable image optimization for Firebase Storage only
    unoptimized: false,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        port: "",
        pathname: "/v0/b/iceinmyarea.firebasestorage.app/**",
      },
    ],
    // Allow all image formats since backend validates
    formats: [
      "image/webp",
      "image/avif",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Optional: Add domains if you need additional flexibility
    domains: [],
  },
};

export default withNextIntl(nextConfig);
