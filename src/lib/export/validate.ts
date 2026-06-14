import "server-only";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/score-categories";
import { listStudentsByYearRoom, studentFullName } from "@/lib/school-app";
import { prisma } from "@/lib/prisma";
import { ROOM_LIMIT } from "./build-workbook";
import type { SubjectWithConfig } from "./assemble";

export interface RoomReport {
  room: number;
  studentCount: number;
  /** เรื่องที่ทำให้ไฟล์ของห้องนี้ใช้ไม่ได้จริง — ห้องนี้โหลดไม่ได้ */
  blockers: string[];
  /** นักเรียนที่ยังมีช่องคะแนนว่าง (เตือนเฉย ๆ) */
  missingByStudent: { name: string; missing: string[] }[];
}

export interface ExportReport {
  /** คำเตือนระดับวิชา — โหลดได้เสมอ แค่บอกให้รู้ว่าไฟล์จะมีส่วนที่ว่าง */
  warnings: string[];
  rooms: RoomReport[];
}

/**
 * ตรวจก่อน export — block เฉพาะที่ทำให้ไฟล์พังจริง (ห้องเกิน 60 คน/ไม่มีนักเรียน)
 * ที่เหลือเป็นคำเตือน: SchoolBright รับไฟล์ที่กรอกบางส่วนได้ ครูบางคนต้องการ import แค่บางช่อง
 */
export async function validateForExport(
  subject: SubjectWithConfig,
  yearId: number,
): Promise<ExportReport> {
  const warnings: string[] = [];
  const config = subject.scoreConfig;

  if (!config) {
    warnings.push("ยังไม่ได้ตั้งสัดส่วนคะแนน — ชีทตั้งค่าสัดส่วนจะว่าง");
  } else if (config.ratioBeforeMid + config.ratioMid + config.ratioAfterMid + config.ratioFinal !== 100) {
    warnings.push("สัดส่วน 4 ช่วงรวมไม่เท่ากับ 100 — SchoolBright อาจปฏิเสธส่วนสัดส่วน");
  }

  const ratioOf: Record<string, number> = {
    BEFORE_MID: config?.ratioBeforeMid ?? 0,
    MID: config?.ratioMid ?? 0,
    AFTER_MID: config?.ratioAfterMid ?? 0,
    FINAL: config?.ratioFinal ?? 0,
  };
  for (const c of CATEGORY_ORDER) {
    if (ratioOf[c] > 0 && !subject.scoreItems.some((i) => i.category === c)) {
      warnings.push(`${CATEGORY_LABELS[c]} มีสัดส่วน ${ratioOf[c]} แต่ยังไม่มีหัวข้อคะแนน — ส่วนนี้จะว่างในไฟล์`);
    }
  }
  for (const i of subject.scoreItems) {
    if (Number(i.maxScore) <= 0) {
      warnings.push(`หัวข้อ "${i.name}" คะแนนเต็มเป็น 0 — SchoolBright อาจไม่รับช่องนี้`);
    }
  }

  const rooms: RoomReport[] = [];
  for (const r of subject.rooms) {
    const students = await listStudentsByYearRoom(yearId, subject.classLevel, r.classRoom);
    const roomBlockers: string[] = [];
    if (students.length === 0) {
      roomBlockers.push("ไม่มีนักเรียนในห้องนี้");
    }
    if (students.length > ROOM_LIMIT) {
      roomBlockers.push(
        `มีนักเรียน ${students.length} คน เกิน ${ROOM_LIMIT} คน/ไฟล์ของ SchoolBright — ต้องแก้ข้อมูลห้องในระบบหลักก่อน`,
      );
    }

    // นักเรียนที่ยังมีช่องว่าง (เฉพาะหมวดคะแนน 4 ช่วง — เตือน ไม่ block)
    const studentIds = students.map((s) => s.id);
    const scores =
      subject.scoreItems.length > 0 && studentIds.length > 0
        ? await prisma.score.findMany({
            where: {
              scoreItemId: { in: subject.scoreItems.map((i) => i.id) },
              studentId: { in: studentIds },
            },
          })
        : [];
    const filled = new Set(
      scores.filter((s) => s.value !== null).map((s) => `${s.scoreItemId}:${s.studentId}`),
    );
    const missingByStudent: RoomReport["missingByStudent"] = [];
    for (const stu of students) {
      const missing = subject.scoreItems
        .filter((i) => !filled.has(`${i.id}:${stu.id}`))
        .map((i) => `${CATEGORY_LABELS[i.category]}: ${i.name}`);
      if (missing.length > 0) {
        missingByStudent.push({ name: `${stu.number_in_room}. ${studentFullName(stu)}`, missing });
      }
    }

    rooms.push({
      room: r.classRoom,
      studentCount: students.length,
      blockers: roomBlockers,
      missingByStudent,
    });
  }

  return { warnings, rooms };
}
