import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["http://localhost:3000", "http://localhost:3001"],
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

const WithNextIntl = createNextIntlPlugin("./app/_i18n/request.ts");

export default WithNextIntl(nextConfig);
