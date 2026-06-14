import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { BASE_PATH } from "@/lib/base-path";
import {
  SESSION_COOKIE,
  SESSION_HOURS,
  signSessionToken,
  verifySessionToken,
  type SessionUser,
} from "@/lib/auth-token";

export type { SessionUser };

/** ตรวจกับตาราง users ของ ScoreBright เอง (score_app) — ไม่เกี่ยวกับ school_app.users */
export async function verifyCredentials(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (!user || !user.isActive) return null;
  // เผื่อ hash สไตล์ PHP ($2y$) ถูก import เข้ามา — bcryptjs ต้องการ prefix $2a$
  const hash = user.passwordHash.replace(/^\$2y\$/, "$2a$");
  const ok = await bcrypt.compare(password, hash);
  if (!ok) return null;
  return {
    uid: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  };
}

// cookie scope ตาม basePath เพื่อไม่ชนกับเว็บอื่นบนโฮสต์เดียวกัน (เช่น 192.168.200.9)
const COOKIE_PATH = BASE_PATH || "/";
// LAN เข้าผ่าน HTTP ไม่มี HTTPS — secure:true จะทำให้ cookie ไม่ถูกส่ง = login พัง
// เปิด secure เฉพาะเมื่อมี HTTPS จริง (ตั้ง COOKIE_SECURE=true ใน .env)
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

export async function createSession(user: SessionUser): Promise<void> {
  const token = await signSessionToken(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    maxAge: SESSION_HOURS * 3600,
    path: COOKIE_PATH,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete({ name: SESSION_COOKIE, path: COOKIE_PATH }); // ต้องระบุ path เดียวกับตอน set
}

/** session ปัจจุบันจาก cookie — null ถ้ายังไม่ login/หมดอายุ */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** ใช้ใน page/action ที่ต้อง login แล้วเท่านั้น (middleware กันชั้นแรกอยู่แล้ว) */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}
