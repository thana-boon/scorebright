"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, type ScoreCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getWorkingPeriod } from "@/lib/app-setting";
import { listLevelRooms } from "@/lib/school-app";
import {
  CATEGORY_LIMITS,
  CATEGORY_LABELS,
  validateItemName,
  validateMaxScore,
} from "@/lib/score-categories";

export interface ActionState {
  error?: string;
  saved?: boolean;
}

/** วิชาต้องเป็นของครูที่ login อยู่เท่านั้น (admin ก็มีวิชาของตัวเอง) */
async function getOwnedSubject(subjectId: number) {
  const session = await requireSession();
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: { rooms: true, scoreConfig: true },
  });
  // admin จัดการวิชาของครูคนอื่นได้
  if (!subject || (subject.teacherId !== session.uid && session.role !== "admin")) return null;
  return subject;
}

// ---------- สร้าง/ลบวิชา ----------

export async function createSubjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const period = await getWorkingPeriod();
  if (!period) return { error: "ยังไม่ได้เลือกปีการศึกษา/ภาคเรียน" };

  const subjectCode = String(formData.get("subjectCode") ?? "").trim();
  const subjectName = String(formData.get("subjectName") ?? "").trim();
  const classLevel = String(formData.get("classLevel") ?? "").trim();
  const rooms = formData
    .getAll("rooms")
    .map((r) => Number(r))
    .filter((r) => Number.isInteger(r) && r > 0);

  if (!subjectCode || subjectCode.length > 20) return { error: "กรุณากรอกรหัสวิชา (ไม่เกิน 20 ตัวอักษร)" };
  if (!subjectName || subjectName.length > 200) return { error: "กรุณากรอกชื่อวิชา" };
  if (!classLevel) return { error: "กรุณาเลือกระดับชั้น" };
  if (rooms.length === 0) return { error: "เลือกห้องที่สอนอย่างน้อย 1 ห้อง" };

  // ห้องต้องมีนักเรียนจริงในปีนี้
  const valid = new Set(
    (await listLevelRooms(period.workingYearId))
      .filter((lr) => lr.class_level === classLevel)
      .map((lr) => lr.class_room),
  );
  const invalid = rooms.filter((r) => !valid.has(r));
  if (invalid.length > 0) return { error: `ห้อง ${invalid.join(", ")} ไม่มีนักเรียนในชั้น ${classLevel}` };

  let subjectId: number;
  try {
    const subject = await prisma.subject.create({
      data: {
        subjectCode,
        subjectName,
        classLevel,
        semester: period.workingSemester,
        academicYearBE: period.workingYearBE,
        teacherId: session.uid,
        rooms: { create: rooms.map((classRoom) => ({ classRoom })) },
      },
    });
    subjectId = subject.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: `มีวิชา ${subjectCode} ของชั้น ${classLevel} ในเทอมนี้อยู่แล้ว` };
    }
    console.error("createSubject:", err);
    return { error: "บันทึกไม่สำเร็จ" };
  }
  revalidatePath("/subjects");
  redirect(`/subjects/${subjectId}`);
}

export async function deleteSubjectAction(subjectId: number): Promise<ActionState> {
  const subject = await getOwnedSubject(subjectId);
  if (!subject) return { error: "ไม่พบวิชาหรือไม่มีสิทธิ์" };
  await prisma.subject.delete({ where: { id: subject.id } }); // cascade ลบสัดส่วน/หัวข้อ/คะแนนทั้งหมด
  revalidatePath("/subjects");
  redirect("/subjects");
}

// ---------- แก้ข้อมูลวิชา + ห้อง ----------

export async function updateSubjectAction(
  subjectId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const subject = await getOwnedSubject(subjectId);
  if (!subject) return { error: "ไม่พบวิชาหรือไม่มีสิทธิ์" };

  const subjectCode = String(formData.get("subjectCode") ?? "").trim();
  const subjectName = String(formData.get("subjectName") ?? "").trim();
  const rooms = formData
    .getAll("rooms")
    .map((r) => Number(r))
    .filter((r) => Number.isInteger(r) && r > 0);

  if (!subjectCode || subjectCode.length > 20) return { error: "กรุณากรอกรหัสวิชา" };
  if (!subjectName || subjectName.length > 200) return { error: "กรุณากรอกชื่อวิชา" };
  if (rooms.length === 0) return { error: "เลือกห้องที่สอนอย่างน้อย 1 ห้อง" };

  try {
    await prisma.$transaction([
      prisma.subject.update({
        where: { id: subject.id },
        data: { subjectCode, subjectName },
      }),
      prisma.subjectRoom.deleteMany({ where: { subjectId: subject.id } }),
      prisma.subjectRoom.createMany({
        data: rooms.map((classRoom) => ({ subjectId: subject.id, classRoom })),
      }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: `มีวิชา ${subjectCode} ของชั้นนี้ในเทอมนี้อยู่แล้ว` };
    }
    console.error("updateSubject:", err);
    return { error: "บันทึกไม่สำเร็จ" };
  }
  revalidatePath(`/subjects/${subject.id}`);
  return { saved: true };
}

// ---------- สัดส่วนคะแนน ----------

export async function saveScoreConfigAction(
  subjectId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const subject = await getOwnedSubject(subjectId);
  if (!subject) return { error: "ไม่พบวิชาหรือไม่มีสิทธิ์" };

  const fields = ["ratioBeforeMid", "ratioMid", "ratioAfterMid", "ratioFinal", "passPercent"] as const;
  const values: Record<(typeof fields)[number], number> = {} as never;
  for (const f of fields) {
    const v = Number(formData.get(f));
    if (!Number.isInteger(v) || v < 0 || v > 100) {
      return { error: "สัดส่วนต้องเป็นจำนวนเต็ม 0-100" };
    }
    values[f] = v;
  }
  const sum = values.ratioBeforeMid + values.ratioMid + values.ratioAfterMid + values.ratioFinal;
  if (sum !== 100) return { error: `สัดส่วน 4 ช่วงต้องรวมเป็น 100 (ตอนนี้ ${sum})` };

  await prisma.scoreConfig.upsert({
    where: { subjectId: subject.id },
    create: { subjectId: subject.id, ...values },
    update: values,
  });
  revalidatePath(`/subjects/${subject.id}`);
  return { saved: true };
}

// ---------- หัวข้อคะแนน ----------

export async function addScoreItemAction(
  subjectId: number,
  category: ScoreCategory,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const subject = await getOwnedSubject(subjectId);
  if (!subject) return { error: "ไม่พบวิชาหรือไม่มีสิทธิ์" };

  const nameCheck = validateItemName(String(formData.get("name") ?? ""));
  if (nameCheck.error) return { error: nameCheck.error };
  const maxCheck = validateMaxScore(String(formData.get("maxScore") ?? ""));
  if (maxCheck.error) return { error: maxCheck.error };

  const count = await prisma.scoreItem.count({ where: { subjectId: subject.id, category } });
  if (count >= CATEGORY_LIMITS[category]) {
    return {
      error: `${CATEGORY_LABELS[category]} มีได้สูงสุด ${CATEGORY_LIMITS[category]} หัวข้อ (เต็มแล้ว)`,
    };
  }
  const last = await prisma.scoreItem.findFirst({
    where: { subjectId: subject.id, category },
    orderBy: { sortOrder: "desc" },
  });

  // ชื่อหัวข้อซ้ำกันได้ — SchoolBright รองรับหัวคอลัมน์ชื่อซ้ำตามปกติ
  await prisma.scoreItem.create({
    data: {
      subjectId: subject.id,
      category,
      name: nameCheck.name!,
      maxScore: maxCheck.value!,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  revalidatePath(`/subjects/${subject.id}`);
  return { saved: true };
}

export async function updateScoreItemAction(
  subjectId: number,
  itemId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const subject = await getOwnedSubject(subjectId);
  if (!subject) return { error: "ไม่พบวิชาหรือไม่มีสิทธิ์" };
  const item = await prisma.scoreItem.findUnique({ where: { id: itemId } });
  if (!item || item.subjectId !== subject.id) return { error: "ไม่พบหัวข้อ" };

  const nameCheck = validateItemName(String(formData.get("name") ?? ""));
  if (nameCheck.error) return { error: nameCheck.error };
  const maxCheck = validateMaxScore(String(formData.get("maxScore") ?? ""));
  if (maxCheck.error) return { error: maxCheck.error };

  await prisma.scoreItem.update({
    where: { id: item.id },
    data: { name: nameCheck.name!, maxScore: maxCheck.value! },
  });
  revalidatePath(`/subjects/${subject.id}`);
  return { saved: true };
}

export async function deleteScoreItemAction(subjectId: number, itemId: number): Promise<ActionState> {
  const subject = await getOwnedSubject(subjectId);
  if (!subject) return { error: "ไม่พบวิชาหรือไม่มีสิทธิ์" };
  const item = await prisma.scoreItem.findUnique({
    where: { id: itemId },
    include: { _count: { select: { scores: true } } },
  });
  if (!item || item.subjectId !== subject.id) return { error: "ไม่พบหัวข้อ" };
  await prisma.scoreItem.delete({ where: { id: item.id } }); // cascade ลบคะแนนของหัวข้อนี้
  revalidatePath(`/subjects/${subject.id}`);
  return { saved: true };
}

/** สลับลำดับหัวข้อขึ้น/ลงภายใน category เดียวกัน */
export async function moveScoreItemAction(
  subjectId: number,
  itemId: number,
  direction: "up" | "down",
): Promise<ActionState> {
  const subject = await getOwnedSubject(subjectId);
  if (!subject) return { error: "ไม่พบวิชาหรือไม่มีสิทธิ์" };
  const item = await prisma.scoreItem.findUnique({ where: { id: itemId } });
  if (!item || item.subjectId !== subject.id) return { error: "ไม่พบหัวข้อ" };

  const neighbor = await prisma.scoreItem.findFirst({
    where: {
      subjectId: subject.id,
      category: item.category,
      sortOrder: direction === "up" ? { lt: item.sortOrder } : { gt: item.sortOrder },
    },
    orderBy: { sortOrder: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return { saved: true }; // สุดทางแล้ว

  await prisma.$transaction([
    prisma.scoreItem.update({ where: { id: item.id }, data: { sortOrder: neighbor.sortOrder } }),
    prisma.scoreItem.update({ where: { id: neighbor.id }, data: { sortOrder: item.sortOrder } }),
  ]);
  revalidatePath(`/subjects/${subject.id}`);
  return { saved: true };
}
