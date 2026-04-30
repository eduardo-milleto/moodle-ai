import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@moodle-ai/db"]
};

export default nextConfig;

