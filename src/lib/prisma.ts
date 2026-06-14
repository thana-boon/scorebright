import { PrismaClient } from "@prisma/client";

// กัน hot-reload ของ dev server สร้าง connection ใหม่ซ้ำ ๆ
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
