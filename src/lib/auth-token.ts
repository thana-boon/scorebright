/**
 * ส่วน JWT ที่ปลอดภัยสำหรับ edge runtime (middleware) — ห้าม import bcrypt/prisma ในไฟล์นี้
 */
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "sb_session";
export const SESSION_HOURS = 12;

export interface SessionUser {
  uid: number;
  username: string;
  displayName: string;
  role: "admin" | "staff";
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.includes("CHANGE_ME")) {
    throw new Error("ยังไม่ได้ตั้งค่า AUTH_SECRET ใน .env");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      uid: payload.uid as number,
      username: payload.username as string,
      displayName: payload.displayName as string,
      role: payload.role as SessionUser["role"],
    };
  } catch {
    return null;
  }
}
