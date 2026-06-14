"use server";

import { Prisma, type TraitKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth";
import { getWorkingPeriod } from "@/lib/app-setting";
import { listStudentsByYear } from "@/lib/school-app";
import { ALL_TRAIT_KINDS, TRAIT_MAX } from "@/lib/trait-columns";

export interface SaveResult {
  ok: boolean;
  saved: number;
  error?: string;
}

export interface ScoreEntry {
  itemId: number;
  studentId: number;
  value: number | null; // null = ล้างช่อง
}

export interface TraitEntry {
  kind: TraitKind;
  studentId: number;
  value: number | null;
}

const CHUNK = 500;

/** วิชาของครูที่ login + ต้องตรงกับปี/เทอมที่ระบบทำงานอยู่ (กันบันทึกข้ามเทอมโดยไม่ตั้งใจ) */
async function getWritableSubject(subjectId: number) {
  const session = await requireSession();
  const period = await getWorkingPeriod();
  if (!period) return { error: "ยังไม่ได้เลือกปีการศึกษา" } as const;
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: { rooms: true, scoreItems: true },
  });
  if (!subject || (subject.teacherId !== session.uid && session.role !== "admin")) {
    return { error: "ไม่พบวิชาหรือไม่มีสิทธิ์" } as const;
  }
  if (subject.academicYearBE !== period.workingYearBE || subject.semester !== period.workingSemester) {
    return { error: "วิชานี้อยู่คนละปี/เทอมกับที่ระบบตั้งไว้ — เปลี่ยนที่หน้าปีการศึกษาก่อน" } as const;
  }
  return { subject, period } as const;
}

/** รายชื่อ id นักเรียนที่อยู่ในห้องที่วิชานี้สอน (ปีที่ทำงาน) */
async function getAllowedStudentIds(
  yearId: number,
  classLevel: string,
  rooms: number[],
): Promise<Set<number>> {
  const students = await listStudentsByYear(yearId);
  const roomSet = new Set(rooms);
  return new Set(
    students
      .filter((s) => s.class_level === classLevel && roomSet.has(s.class_room))
      .map((s) => s.id),
  );
}

export async function saveScoresAction(
  subjectId: number,
  entries: ScoreEntry[],
): Promise<SaveResult> {
  const ctx = await getWritableSubject(subjectId);
  if ("error" in ctx) return { ok: false, saved: 0, error: ctx.error };
  const { subject, period } = ctx;
  if (entries.length === 0) return { ok: true, saved: 0 };

  const itemMax = new Map(subject.scoreItems.map((i) => [i.id, Number(i.maxScore)]));
  const allowed = await getAllowedStudentIds(
    period.workingYearId,
    subject.classLevel,
    subject.rooms.map((r) => r.classRoom),
  );

  const valid: ScoreEntry[] = [];
  for (const e of entries) {
    const max = itemMax.get(e.itemId);
    if (max === undefined) return { ok: false, saved: 0, error: `หัวข้อ ${e.itemId} ไม่อยู่ในวิชานี้` };
    if (!allowed.has(e.studentId)) {
      return { ok: false, saved: 0, error: `นักเรียน ${e.studentId} ไม่อยู่ในห้องของวิชานี้` };
    }
    if (e.value !== null) {
      if (!Number.isFinite(e.value) || e.value < 0 || e.value > max) {
        return { ok: false, saved: 0, error: `คะแนนต้องอยู่ระหว่าง 0-${max}` };
      }
      if (Math.round(e.value * 100) !== e.value * 100) {
        return { ok: false, saved: 0, error: "ทศนิยมได้ไม่เกิน 2 ตำแหน่ง" };
      }
    }
    valid.push(e);
  }

  // bulk upsert — รองรับ paste จาก Excel ทีละหลายพันช่อง
  for (let i = 0; i < valid.length; i += CHUNK) {
    const chunk = valid.slice(i, i + CHUNK);
    const rows = chunk.map((e) => Prisma.sql`(${e.itemId}, ${e.studentId}, ${e.value}, NOW())`);
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO scores (score_item_id, student_id, value, updated_at)
      VALUES ${Prisma.join(rows)}
      ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()
    `);
  }
  return { ok: true, saved: valid.length };
}

export async function saveTraitsAction(
  subjectId: number,
  entries: TraitEntry[],
): Promise<SaveResult> {
  const ctx = await getWritableSubject(subjectId);
  if ("error" in ctx) return { ok: false, saved: 0, error: ctx.error };
  const { subject, period } = ctx;
  if (entries.length === 0) return { ok: true, saved: 0 };

  const kinds = new Set<string>(ALL_TRAIT_KINDS);
  const allowed = await getAllowedStudentIds(
    period.workingYearId,
    subject.classLevel,
    subject.rooms.map((r) => r.classRoom),
  );

  for (const e of entries) {
    if (!kinds.has(e.kind)) return { ok: false, saved: 0, error: `หัวข้อ ${e.kind} ไม่ถูกต้อง` };
    if (!allowed.has(e.studentId)) {
      return { ok: false, saved: 0, error: `นักเรียน ${e.studentId} ไม่อยู่ในห้องของวิชานี้` };
    }
    if (e.value !== null && (!Number.isInteger(e.value) || e.value < 0 || e.value > TRAIT_MAX)) {
      return { ok: false, saved: 0, error: `คะแนนส่วนนี้ต้องเป็นจำนวนเต็ม 0-${TRAIT_MAX}` };
    }
  }

  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK);
    const rows = chunk.map(
      (e) => Prisma.sql`(${subject.id}, ${e.studentId}, ${e.kind}, ${e.value}, NOW())`,
    );
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO trait_scores (subject_id, student_id, kind, value, updated_at)
      VALUES ${Prisma.join(rows)}
      ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()
    `);
  }
  return { ok: true, saved: entries.length };
}
