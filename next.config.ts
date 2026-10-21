import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  agentRules: false,
  async headers(){
    return [{source:"/sw.js",headers:[
      {key:"Content-Type",value:"application/javascript; charset=utf-8"},
      {key:"Cache-Control",value:"no-cache, no-store, must-revalidate"},
      {key:"X-Content-Type-Options",value:"nosniff"},
    ]}];
  },
  async redirects() {
    return [{ source: "/", destination: "/app", permanent: false }];
  },
};

export default nextConfig;
