import type { NextConfig } from "next";

// basePath มาจาก env (prod = /scorebright, dev เว้นว่าง = root)
// NEXT_PUBLIC_BASE_PATH ต้องตั้งตอน build เพราะ basePath ถูกฝังตอน build time
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
};

export default nextConfig;
