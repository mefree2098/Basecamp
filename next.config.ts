import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  generateBuildId: async () => process.env.BASECAMP_BUILD_ID?.trim() || null
};

export default nextConfig;
