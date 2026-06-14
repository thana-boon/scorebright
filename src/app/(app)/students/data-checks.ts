import type { Student } from "@/lib/school-app";

/** limit ของ template SchoolBright: 60 คน/ไฟล์ — ห้องที่เกินจะ export ไม่ได้ */
export const ROOM_LIMIT = 60;

export interface DataCheckResult {
  duplicateCodes: { code: string; students: Student[] }[];
  duplicateNumbers: { level: string; room: number; number: number; students: Student[] }[];
  overLimitRooms: { level: string; room: number; count: number }[];
}

/**
 * ตรวจสุขภาพข้อมูลนักเรียนของปีการศึกษาที่เลือก —
 * ปัญหาพวกนี้แก้ในระบบต้นทาง (school_app) เท่านั้น แอปนี้ได้แต่ชี้จุด
 */
export function runDataChecks(students: Student[]): DataCheckResult {
  const byCode = new Map<string, Student[]>();
  const byRoomNumber = new Map<string, Student[]>();
  const byRoom = new Map<string, Student[]>();

  for (const s of students) {
    const code = s.student_code.trim();
    byCode.set(code, [...(byCode.get(code) ?? []), s]);
    const rnKey = `${s.class_level}|${s.class_room}|${s.number_in_room}`;
    byRoomNumber.set(rnKey, [...(byRoomNumber.get(rnKey) ?? []), s]);
    const roomKey = `${s.class_level}|${s.class_room}`;
    byRoom.set(roomKey, [...(byRoom.get(roomKey) ?? []), s]);
  }

  const duplicateCodes = [...byCode.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([code, list]) => ({ code, students: list }));

  const duplicateNumbers = [...byRoomNumber.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => {
      const [level, room, number] = key.split("|");
      return { level, room: Number(room), number: Number(number), students: list };
    });

  const overLimitRooms = [...byRoom.entries()]
    .filter(([, list]) => list.length > ROOM_LIMIT)
    .map(([key, list]) => {
      const [level, room] = key.split("|");
      return { level, room: Number(room), count: list.length };
    });

  return { duplicateCodes, duplicateNumbers, overLimitRooms };
}
