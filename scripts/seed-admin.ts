/**
 * สร้าง/รีเซ็ตบัญชี admin ของ ScoreBright (ตาราง users ใน score_app — ไม่แตะ school_app)
 *
 * ใช้: npm run seed:admin                          → admin / admin1234
 *      npx tsx scripts/seed-admin.ts ชื่อ รหัสผ่าน  → กำหนดเอง
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const username = process.argv[2] ?? "admin";
const password = process.argv[3] ?? "admin1234";

try {
  process.loadEnvFile(); // โหลด .env (Node 20.12+)
} catch {}

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { username },
    create: {
      username,
      passwordHash,
      displayName: "ผู้ดูแลระบบ",
      role: "admin",
      isActive: true,
    },
    update: { passwordHash, role: "admin", isActive: true },
  });
  console.log(`บัญชี '${user.username}' (id=${user.id}) พร้อมใช้งาน`);
  console.log(`เข้าระบบได้ด้วย  username: ${username}  password: ${password}`);
  if (password === "admin1234") {
    console.log("คำเตือน: รหัสผ่านเริ่มต้นเดาง่าย — เปลี่ยนก่อนใช้งานจริง");
  }
}

main()
  .catch((err) => {
    console.error("seed ไม่สำเร็จ:", err instanceof Error ? err.message.trim() : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
