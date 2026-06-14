/**
 * การเข้าถึงฐานข้อมูล school_app — อ่านอย่างเดียวเท่านั้น (SELECT)
 * ใช้เฉพาะข้อมูลนักเรียน/ปีการศึกษา — บัญชีผู้ใช้เป็นของ ScoreBright เอง (ตาราง users ใน score_app)
 * MySQL user ของแอปต้องมีสิทธิ์ SELECT บน school_app (ดู README)
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface AcademicYear {
  id: number;
  year_be: number;
  title: string | null;
  is_active: number;
}

export interface Student {
  id: number;
  student_code: string;
  first_name: string;
  last_name: string;
  class_level: string;
  class_room: number;
  number_in_room: number;
}

/** คอลัมน์ int UNSIGNED ของ MySQL กลับมาจาก raw query เป็น BigInt — แปลงเป็น number ก่อนใช้ */
function num(v: number | bigint): number {
  return typeof v === "bigint" ? Number(v) : v;
}

function normalizeYear(r: AcademicYear): AcademicYear {
  return { ...r, id: num(r.id), year_be: num(r.year_be), is_active: num(r.is_active) };
}

function normalizeStudent(r: Student): Student {
  return {
    ...r,
    id: num(r.id),
    class_room: num(r.class_room),
    number_in_room: num(r.number_in_room),
  };
}

export function studentFullName(s: Pick<Student, "first_name" | "last_name">): string {
  // first_name มีคำนำหน้าติดมาแล้ว เช่น 'เด็กชายธีรภาพ'
  return `${s.first_name} ${s.last_name}`;
}

export async function listAcademicYears(): Promise<AcademicYear[]> {
  const rows = await prisma.$queryRaw<AcademicYear[]>(Prisma.sql`
    SELECT id, year_be, title, is_active
    FROM school_app.academic_years
    ORDER BY year_be DESC
  `);
  return rows.map(normalizeYear);
}

export async function getAcademicYearById(id: number): Promise<AcademicYear | null> {
  const rows = await prisma.$queryRaw<AcademicYear[]>(Prisma.sql`
    SELECT id, year_be, title, is_active
    FROM school_app.academic_years
    WHERE id = ${id}
    LIMIT 1
  `);
  return rows[0] ? normalizeYear(rows[0]) : null;
}

export async function getActiveAcademicYear(): Promise<AcademicYear | null> {
  const rows = await prisma.$queryRaw<AcademicYear[]>(Prisma.sql`
    SELECT id, year_be, title, is_active
    FROM school_app.academic_years
    WHERE is_active = 1
    ORDER BY year_be DESC
    LIMIT 1
  `);
  return rows[0] ? normalizeYear(rows[0]) : null;
}

export interface LevelRoom {
  class_level: string;
  class_room: number;
  student_count: number;
}

/** ห้องเรียนที่มีนักเรียนจริงในปีการศึกษา — ใช้เป็นตัวเลือกห้องตอนสร้างวิชา */
export async function listLevelRooms(yearId: number): Promise<LevelRoom[]> {
  const rows = await prisma.$queryRaw<
    { class_level: string; class_room: number | bigint; student_count: bigint }[]
  >(Prisma.sql`
    SELECT class_level, class_room, COUNT(*) AS student_count
    FROM school_app.students
    WHERE year_id = ${yearId}
    GROUP BY class_level, class_room
    ORDER BY class_level ASC, class_room ASC
  `);
  return rows.map((r) => ({
    class_level: r.class_level,
    class_room: num(r.class_room),
    student_count: num(r.student_count),
  }));
}

/** นักเรียนทั้งหมดของปีการศึกษา — เรียงตามชั้น/ห้อง/เลขที่ (ทุก query ต้อง scope year_id เสมอ) */
export async function listStudentsByYear(yearId: number): Promise<Student[]> {
  const rows = await prisma.$queryRaw<Student[]>(Prisma.sql`
    SELECT id, student_code, first_name, last_name, class_level, class_room, number_in_room
    FROM school_app.students
    WHERE year_id = ${yearId}
    ORDER BY class_level ASC, class_room ASC, number_in_room ASC
  `);
  return rows.map(normalizeStudent);
}

export async function listStudentsByYearRoom(
  yearId: number,
  classLevel: string,
  classRoom: number,
): Promise<Student[]> {
  const rows = await prisma.$queryRaw<Student[]>(Prisma.sql`
    SELECT id, student_code, first_name, last_name, class_level, class_room, number_in_room
    FROM school_app.students
    WHERE year_id = ${yearId} AND class_level = ${classLevel} AND class_room = ${classRoom}
    ORDER BY number_in_room ASC
  `);
  return rows.map(normalizeStudent);
}
