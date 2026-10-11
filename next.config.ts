import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/api/try-on": ["./public/closet/*.jpg"] },
};

export default nextConfig;
