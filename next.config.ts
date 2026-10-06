import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  agentRules: false,
  async redirects() {
    return [{ source: "/", destination: "/app", permanent: false }];
  },
};

export default nextConfig;
