/** การคิดเกรดจากคะแนนถ่วงน้ำหนักตามสัดส่วน — เกณฑ์มาตรฐาน 8 ระดับ */

export interface GradeBand {
  min: number; // คะแนน >= ค่านี้ (จาก 100)
  grade: string;
  value: number; // ค่าเกรดเชิงตัวเลข สำหรับหา GPA
}

// เกณฑ์มาตรฐานกระทรวงศึกษาธิการ
export const GRADE_BANDS: GradeBand[] = [
  { min: 80, grade: "4", value: 4.0 },
  { min: 75, grade: "3.5", value: 3.5 },
  { min: 70, grade: "3", value: 3.0 },
  { min: 65, grade: "2.5", value: 2.5 },
  { min: 60, grade: "2", value: 2.0 },
  { min: 55, grade: "1.5", value: 1.5 },
  { min: 50, grade: "1", value: 1.0 },
  { min: 0, grade: "0", value: 0.0 },
];

export function toGrade(total: number): GradeBand {
  return GRADE_BANDS.find((b) => total >= b.min) ?? GRADE_BANDS[GRADE_BANDS.length - 1];
}

export interface CategoryScore {
  ratio: number; // สัดส่วนของช่วงนี้ (0-100)
  rawScore: number; // คะแนนดิบที่ได้รวมในช่วง
  rawMax: number; // คะแนนเต็มดิบรวมของช่วง
  weighted: number; // คะแนนถ่วงน้ำหนักแล้ว (จาก ratio)
  hasItems: boolean;
}

export interface StudentGrade {
  total: number; // คะแนนรวม 0-100 (ปัด 2 ตำแหน่ง)
  grade: GradeBand;
  /** ยังกรอกไม่ครบทุกช่องที่มีหัวข้อ */
  incomplete: boolean;
}

/**
 * คะแนนช่วงหนึ่ง: ได้ (คะแนนดิบ/เต็มดิบ) × สัดส่วน
 * ช่องที่ยังไม่กรอก (null) นับเป็น 0 — แต่ตั้ง flag incomplete ไว้เตือน
 */
export function categoryScore(
  ratio: number,
  values: (number | null)[],
  maxes: number[],
): CategoryScore {
  const rawMax = maxes.reduce((a, b) => a + b, 0);
  const rawScore = values.reduce<number>((a, v) => a + (v ?? 0), 0);
  const weighted = rawMax > 0 ? (rawScore / rawMax) * ratio : 0;
  return { ratio, rawScore, rawMax, weighted, hasItems: maxes.length > 0 };
}

export function computeGrade(categories: CategoryScore[], anyMissing: boolean): StudentGrade {
  const total = Math.round(categories.reduce((a, c) => a + c.weighted, 0) * 100) / 100;
  return { total, grade: toGrade(total), incomplete: anyMissing };
}
