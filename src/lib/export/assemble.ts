import "server-only";
import { prisma } from "@/lib/prisma";
import { listStudentsByYearRoom, studentFullName } from "@/lib/school-app";
import { CATEGORY_ORDER } from "@/lib/score-categories";
import {
  BEHAVIOR_COLUMNS,
  COMPETENCY_COLUMNS,
  READ_COLUMNS,
} from "@/lib/trait-columns";
import type { ExportData, ExportItem, ExportStudent } from "./build-workbook";
import { EXPORT_SECTIONS, type ExportSection } from "./sections";
import type { Prisma } from "@prisma/client";

export type SubjectWithConfig = Prisma.SubjectGetPayload<{
  include: { rooms: true; scoreConfig: true; scoreItems: true };
}>;

export async function getExportSubject(subjectId: number): Promise<SubjectWithConfig | null> {
  return prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      rooms: { orderBy: { classRoom: "asc" } },
      scoreConfig: true,
      scoreItems: { orderBy: [{ category: "asc" }, { sortOrder: "asc" }] },
    },
  });
}

/**
 * ประกอบข้อมูล export ของวิชา 1 ห้อง (เรียงตามเลขที่)
 * include = ส่วนที่เลือก export — ส่วนที่ไม่เลือกจะว่างในไฟล์ (SchoolBright จะไม่แตะข้อมูลส่วนนั้น)
 * รายชื่อ/รหัสนักเรียนเขียนทุกชีทเสมอ เพราะเป็น key ที่ SchoolBright ใช้จับคู่
 */
export async function assembleRoomData(
  subject: SubjectWithConfig,
  yearId: number,
  room: number,
  include: Set<ExportSection> = new Set(EXPORT_SECTIONS),
): Promise<ExportData> {
  const config = subject.scoreConfig;

  const students = await listStudentsByYearRoom(yearId, subject.classLevel, room);
  const studentIds = students.map((s) => s.id);

  const itemsOf = Object.fromEntries(
    CATEGORY_ORDER.map((c) => [
      c,
      subject.scoreItems.filter((i) => i.category === c),
    ]),
  );
  // ส่วนคะแนนที่ไม่เลือก: ตัดหัวข้อออก → ชีทนั้นว่างทั้ง header และคะแนน
  if (!include.has("beforeMid")) itemsOf.BEFORE_MID = [];
  if (!include.has("mid")) itemsOf.MID = [];
  if (!include.has("afterMid")) itemsOf.AFTER_MID = [];
  if (!include.has("final")) itemsOf.FINAL = [];

  const [scores, traits] = await Promise.all([
    subject.scoreItems.length > 0 && studentIds.length > 0
      ? prisma.score.findMany({
          where: {
            scoreItemId: { in: subject.scoreItems.map((i) => i.id) },
            studentId: { in: studentIds },
          },
        })
      : Promise.resolve([]),
    studentIds.length > 0
      ? prisma.traitScore.findMany({
          where: { subjectId: subject.id, studentId: { in: studentIds } },
        })
      : Promise.resolve([]),
  ]);

  const scoreMap = new Map<string, number>();
  for (const s of scores) {
    if (s.value !== null) scoreMap.set(`${s.scoreItemId}:${s.studentId}`, Number(s.value));
  }
  const traitMap = new Map<string, number>();
  for (const t of traits) {
    if (t.value !== null) traitMap.set(`${t.kind}:${t.studentId}`, t.value);
  }

  const toItem = (i: (typeof subject.scoreItems)[number]): ExportItem => ({
    name: i.name,
    max: Number(i.maxScore),
  });

  const exportStudents: ExportStudent[] = students.map((stu) => ({
    no: stu.number_in_room,
    code: stu.student_code,
    fullName: studentFullName(stu),
    beforeMid: itemsOf.BEFORE_MID.map((i) => scoreMap.get(`${i.id}:${stu.id}`) ?? null),
    mid: itemsOf.MID.map((i) => scoreMap.get(`${i.id}:${stu.id}`) ?? null),
    afterMid: itemsOf.AFTER_MID.map((i) => scoreMap.get(`${i.id}:${stu.id}`) ?? null),
    final: itemsOf.FINAL.map((i) => scoreMap.get(`${i.id}:${stu.id}`) ?? null),
    behavior: BEHAVIOR_COLUMNS.map((c) =>
      include.has("behavior") ? traitMap.get(`${c.kind}:${stu.id}`) ?? null : null,
    ),
    readWrite: READ_COLUMNS.map((c) =>
      include.has("readWrite") ? traitMap.get(`${c.kind}:${stu.id}`) ?? null : null,
    ),
    competency: COMPETENCY_COLUMNS.map((c) =>
      include.has("competency") ? traitMap.get(`${c.kind}:${stu.id}`) ?? null : null,
    ),
  }));

  return {
    ratios:
      include.has("ratio") && config
        ? {
            beforeMid: config.ratioBeforeMid,
            mid: config.ratioMid,
            afterMid: config.ratioAfterMid,
            final: config.ratioFinal,
            passPercent: config.passPercent,
          }
        : null,
    beforeMidItems: itemsOf.BEFORE_MID.map(toItem),
    midItems: itemsOf.MID.map(toItem),
    afterMidItems: itemsOf.AFTER_MID.map(toItem),
    finalItems: itemsOf.FINAL.map(toItem),
    students: exportStudents,
  };
}

/** ชื่อไฟล์ตามแบบแผน: ว22101_ม.2-1_เทอม1-2569.xlsx */
export function exportFileName(subject: SubjectWithConfig, room: number): string {
  return `${subject.subjectCode}_${subject.classLevel}-${room}_เทอม${subject.semester}-${subject.academicYearBE}.xlsx`;
}

export function exportZipName(subject: SubjectWithConfig): string {
  return `${subject.subjectCode}_${subject.classLevel}_เทอม${subject.semester}-${subject.academicYearBE}.zip`;
}
