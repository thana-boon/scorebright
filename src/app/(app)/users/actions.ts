"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { Prisma, type UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { listTeachers, teacherDisplayName } from "@/lib/teacher-api";

export interface UserActionState {
  error?: string;
  saved?: boolean;
  /** ข้อความสรุปผลการซิงค์ (เช่น "เพิ่ม 3 อัปเดต 12 ปิด 1") */
  summary?: string;
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

export async function deleteUserAction(
  userId: number,
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  const session = await requireAdmin();

  if (userId === session.uid) {
    return { error: "ลบบัญชีของตัวเองไม่ได้" };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { _count: { select: { subjects: true } } },
  });
  if (!target) return { error: "ไม่พบผู้ใช้นี้ (อาจถูกลบไปแล้ว)" };

  if (target.role === "admin") {
    const otherAdmins = await prisma.user.count({
      where: { role: "admin", isActive: true, id: { not: userId } },
    });
    if (otherAdmins === 0) {
      return { error: "ระบบต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อย 1 คน" };
    }
  }

  // ค่าว่าง = ลบวิชาและคะแนนทั้งหมดทิ้ง / มีค่า = โอนวิชาให้ครูคนอื่นดูแลแทน
  const raw = String(formData.get("reassignTo") ?? "").trim();
  const reassignTo = raw ? Number(raw) : null;

  if (reassignTo !== null) {
    if (!Number.isInteger(reassignTo) || reassignTo === userId) {
      return { error: "ผู้รับช่วงวิชาไม่ถูกต้อง" };
    }
    const newOwner = await prisma.user.findUnique({ where: { id: reassignTo } });
    if (!newOwner) return { error: "ไม่พบผู้ใช้ที่จะรับช่วงวิชา" };
  }

  try {
    if (reassignTo !== null) {
      // โอนวิชาให้ครูคนใหม่ก่อน แล้วค่อยลบบัญชี — คะแนนเดิมยังอยู่ครบ
      await prisma.$transaction([
        prisma.subject.updateMany({
          where: { teacherId: userId },
          data: { teacherId: reassignTo },
        }),
        prisma.user.delete({ where: { id: userId } }),
      ]);
    } else {
      // ลบวิชาทั้งหมด (cascade ลบ rooms/config/items/scores/traits) แล้วลบบัญชี
      await prisma.$transaction([
        prisma.subject.deleteMany({ where: { teacherId: userId } }),
        prisma.user.delete({ where: { id: userId } }),
      ]);
    }
  } catch (err) {
    console.error("deleteUser:", err);
    return { error: "ลบไม่สำเร็จ" };
  }

  revalidatePath("/users");
  return { saved: true };
}

export async function resetPasswordAction(
  userId: number,
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  await requireAdmin();

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "ไม่พบผู้ใช้นี้" };
  if (target.source === "teacher_api") {
    return { error: "บัญชีครูที่ซิงค์มาใช้รหัสจากระบบกลาง — เปลี่ยนรหัสที่ระบบกลางแทน" };
  }

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

/**
 * ซิงค์รายชื่อครูจาก teacher-api เข้าตาราง users (source = teacher_api)
 * - ครูใหม่: สร้างบัญชี role = staff, isActive = true, username = teacher_code
 * - ครูเดิม: อัปเดตชื่อที่แสดง + เปิดใช้งานกลับ — ไม่แตะ role ที่ admin ตั้งไว้
 * - ครูที่หายไปจาก API: ปิดใช้งาน (ไม่ลบ — วิชา/คะแนนยังอยู่ครบ)
 * บัญชี source = local (เช่น admin ที่สร้างเอง) ไม่ถูกแตะต้อง
 */
export async function syncTeachersAction(
  _prev: UserActionState,
  _formData: FormData,
): Promise<UserActionState> {
  await requireAdmin();

  let teachers;
  try {
    teachers = await listTeachers();
  } catch (err) {
    console.error("syncTeachers: API error", err);
    return { error: "เชื่อมต่อ teacher-api ไม่ได้ ตรวจ TEACHER_API_BASE_URL / TEACHER_API_KEY ใน .env" };
  }

  const allUsers = await prisma.user.findMany();
  const existing = allUsers.filter((u) => u.source === "teacher_api");
  const existingByCode = new Map(existing.map((u) => [u.username, u]));
  // username ที่ถูกบัญชี local จองไว้ (กันไม่ให้ sync ไปทับบัญชีที่สร้างเอง)
  const localUsernames = new Set(allUsers.filter((u) => u.source === "local").map((u) => u.username));
  const apiCodes = new Set<string>();

  let created = 0;
  let updated = 0;
  let deactivated = 0;
  let skipped = 0;

  // ครูรหัสขึ้นต้น A ไม่มีรหัสผ่านในระบบกลาง → login ไม่ได้ ไม่ต้องสร้างบัญชี
  const loginable = teachers.filter((t) => !/^a/i.test(t.teacher_code.trim()));

  try {
    for (const t of loginable) {
      const code = t.teacher_code.trim();
      if (!code) continue;
      apiCodes.add(code);
      const displayName = teacherDisplayName(t).slice(0, 100);
      const current = existingByCode.get(code);

      if (!current) {
        if (localUsernames.has(code)) {
          // มีบัญชีในระบบที่ใช้ username นี้อยู่แล้ว — ข้าม ไม่ทับ
          skipped += 1;
          continue;
        }
        await prisma.user.create({
          data: {
            username: code,
            displayName,
            passwordHash: null,
            role: "staff",
            source: "teacher_api",
            isActive: true,
          },
        });
        created += 1;
      } else if (current.displayName !== displayName || !current.isActive) {
        // อัปเดตชื่อ + เปิดใช้งานกลับ แต่คง role เดิมเสมอ
        await prisma.user.update({
          where: { id: current.id },
          data: { displayName, isActive: true },
        });
        updated += 1;
      }
    }

    // ครูที่ไม่อยู่ใน API แล้ว → ปิดใช้งาน (เฉพาะที่ยังเปิดอยู่)
    for (const u of existing) {
      if (!apiCodes.has(u.username) && u.isActive) {
        await prisma.user.update({ where: { id: u.id }, data: { isActive: false } });
        deactivated += 1;
      }
    }
  } catch (err) {
    console.error("syncTeachers: db error", err);
    return { error: "บันทึกผลซิงค์ไม่สำเร็จ" };
  }

  revalidatePath("/users");
  const skippedNote = skipped > 0 ? ` ข้าม ${skipped} (ชื่อซ้ำบัญชีเดิม)` : "";
  return {
    saved: true,
    summary: `ซิงค์สำเร็จ — เพิ่ม ${created} อัปเดต ${updated} ปิดใช้งาน ${deactivated}${skippedNote} (ครูที่ login ได้ ${loginable.length} จากทั้งหมด ${teachers.length} คน)`,
  };
}
