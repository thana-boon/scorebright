import type { TraitKind } from "@prisma/client";

/**
 * คอลัมน์ตรงกับ template SchoolBright แบบ 1:1 (คะแนน 0-3 ทุกช่อง)
 * - คุณลักษณะอันพึงประสงค์: ชีทมี 20 ช่อง (D:W) — 8 ช่องแรกชื่อตายตัวตามหลักสูตร
 *   ช่อง 9-20 เป็นช่องสำรองของ template (หัวคอลัมน์เป็นตัวเลข) เผื่อ SchoolBright เพิ่มหัวข้อ
 * - อ่านคิดวิเคราะห์: 5 ช่อง (D:H) — ใช้จริง 3
 * - สมรรถนะ: 10 ช่อง (D:M) — 5 ช่องแรกใช้ชื่อมาตรฐานหลักสูตรแกนกลาง
 *   (template เขียนว่า "หัวข้อตามที่ตั้งค่าในระบบ")
 */
export const TRAIT_MAX = 3;

export interface TraitColumn {
  kind: TraitKind;
  label: string; // ตรงกับหัวคอลัมน์ใน template
  reserved?: boolean; // ช่องสำรอง — template ยังไม่ได้ตั้งชื่อ
}

function reserved(prefix: "TRAIT" | "READ" | "COMPETENCY", from: number, to: number): TraitColumn[] {
  const cols: TraitColumn[] = [];
  for (let i = from; i <= to; i++) {
    cols.push({ kind: `${prefix}_${i}` as TraitKind, label: String(i), reserved: true });
  }
  return cols;
}

export const BEHAVIOR_COLUMNS: TraitColumn[] = [
  { kind: "TRAIT_1", label: "1 รักชาติ ศาสน์ กษัตริย์" },
  { kind: "TRAIT_2", label: "2 ซื่อสัตย์สุจริต" },
  { kind: "TRAIT_3", label: "3 มีวินัย" },
  { kind: "TRAIT_4", label: "4 ใฝ่เรียนรู้" },
  { kind: "TRAIT_5", label: "5 อยู่อย่างพอเพียง" },
  { kind: "TRAIT_6", label: "6 มุ่งมั่นในการทำงาน" },
  { kind: "TRAIT_7", label: "7 รักความเป็นไทย" },
  { kind: "TRAIT_8", label: "8 มีจิตสาธารณะ" },
  ...reserved("TRAIT", 9, 20),
];

export const READ_COLUMNS: TraitColumn[] = [
  { kind: "READ_1", label: "1 การอ่าน" },
  { kind: "READ_2", label: "2 การคิดวิเคราะห์" },
  { kind: "READ_3", label: "3 การเขียน" },
  ...reserved("READ", 4, 5),
];

export const COMPETENCY_COLUMNS: TraitColumn[] = [
  { kind: "COMPETENCY_1", label: "1 การสื่อสาร" },
  { kind: "COMPETENCY_2", label: "2 การคิด" },
  { kind: "COMPETENCY_3", label: "3 การแก้ปัญหา" },
  { kind: "COMPETENCY_4", label: "4 ทักษะชีวิต" },
  { kind: "COMPETENCY_5", label: "5 การใช้เทคโนโลยี" },
  ...reserved("COMPETENCY", 6, 10),
];

export const ALL_TRAIT_KINDS: TraitKind[] = [
  ...BEHAVIOR_COLUMNS,
  ...READ_COLUMNS,
  ...COMPETENCY_COLUMNS,
].map((c) => c.kind);
