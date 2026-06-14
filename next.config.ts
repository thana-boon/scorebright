import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // สำหรับ deploy บน Windows Server (pm2/บริการ Windows + reverse proxy)
};

export default nextConfig;
