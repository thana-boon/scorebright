"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";

export interface UserActionState {
  error?: string;
  saved?: boolean;
}

async function requireAdmin() {
  const session = await requireSession();
  if (session.role !== "admin") throw new Error("FORBIDDEN");
  return session;
}

function validateUsername(raw: string): { username?: string; error?: string } {
  const username = raw.trim().toLowerCase();
  if (username.length < 3 || username.length > 50) return { error: "ชื่อผู้ใช้ต้องยาว 3-50 ตัวอักษร" };
  if (!/^[a-z0-9_.-]+$/.test(username)) {
    return { error: "ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 จุด ขีด และ _" };
  }
  return { username };
}

function validatePassword(raw: string): string | null {
  if (raw.length < 6) return "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร";
  if (raw.length > 100) return "รหัสผ่านยาวเกินไป";
  return null;
}

/** ห้ามทำให้ระบบไม่เหลือ admin ที่ใช้งานได้ */
async function wouldRemoveLastAdmin(targetId: number, nextRole: UserRole, nextActive: boolean) {
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return false;
  const losesAdmin = target.role === "admin" && (nextRole !== "admin" || !nextActive);
  if (!losesAdmin) return false;
  const otherAdmins = await prisma.user.count({
    where: { role: "admin", isActive: true, id: { not: targetId } },
  });
  return otherAdmins === 0;
}

export async function createUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  await requireAdmin();

  const nameCheck = validateUsername(String(formData.get("username") ?? ""));
  if (nameCheck.error) return { error: nameCheck.error };
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName || displayName.length > 100) return { error: "กรุณากรอกชื่อที่แสดง" };
  const password = String(formData.get("password") ?? "");
  const pwError = validatePassword(password);
  if (pwError) return { error: pwError };
  const role = formData.get("role") === "admin" ? "admin" : "staff";

  try {
    await prisma.user.create({
      data: {
        username: nameCheck.username!,
        displayName,
        passwordHash: await bcrypt.hash(password, 10),
        role,
        isActive: true,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: `ชื่อผู้ใช้ "${nameCheck.username}" มีอยู่แล้ว` };
    }
    console.error("createUser:", err);
    return { error: "บันทึกไม่สำเร็จ" };
  }
  revalidatePath("/users");
  return { saved: true };
}

export async function updateUserAction(
  userId: number,
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const session = await requireAdmin();

  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName || displayName.length > 100) return { error: "กรุณากรอกชื่อที่แสดง" };
  const role: UserRole = formData.get("role") === "admin" ? "admin" : "staff";
  const isActive = formData.get("isActive") === "on";

  if (userId === session.uid && (role !== "admin" || !isActive)) {
    return { error: "ลดสิทธิ์หรือปิดบัญชีของตัวเองไม่ได้" };
  }
  if (await wouldRemoveLastAdmin(userId, role, isActive)) {
    return { error: "ระบบต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อย 1 คน" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { displayName, role, isActive },
  });
  revalidatePath("/users");
  return { saved: true };
}

export async function resetPasswordAction(
  userId: number,
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  await requireAdmin();
  const password = String(formData.get("password") ?? "");
  const pwError = validatePassword(password);
  if (pwError) return { error: pwError };

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  revalidatePath("/users");
  return { saved: true };
}
