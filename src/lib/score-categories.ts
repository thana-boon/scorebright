import type { ScoreCategory } from "@prisma/client";

/** limit จำนวนหัวข้อต่อหมวด = จำนวนคอลัมน์ใน template SchoolBright */
export const CATEGORY_LIMITS: Record<ScoreCategory, number> = {
  BEFORE_MID: 20,
  MID: 10,
  AFTER_MID: 20,
  FINAL: 10,
};

export const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  BEFORE_MID: "คะแนนเก็บก่อนกลางภาค",
  MID: "สอบกลางภาค",
  AFTER_MID: "คะแนนเก็บหลังกลางภาค",
  FINAL: "สอบปลายภาค",
};

export const CATEGORY_ORDER: ScoreCategory[] = ["BEFORE_MID", "MID", "AFTER_MID", "FINAL"];

/**
 * ตรวจชื่อหัวข้อคะแนน — จะกลายเป็นหัวคอลัมน์ใน Excel จริง
 * ห้ามขึ้นต้นด้วยอักขระที่ Excel ตีความเป็นสูตร (formula injection)
 */
export function validateItemName(raw: string): { name?: string; error?: string } {
  const name = raw.trim();
  if (!name) return { error: "กรุณากรอกชื่อหัวข้อ" };
  if (name.length > 100) return { error: "ชื่อหัวข้อยาวเกิน 100 ตัวอักษร" };
  if (/^[=+\-@]/.test(name)) {
    return { error: "ชื่อหัวข้อห้ามขึ้นต้นด้วย = + - หรือ @ (Excel จะตีความเป็นสูตร)" };
  }
  return { name };
}

/** คะแนนเต็มของหัวข้อ: ตัวเลขบวก ทศนิยมไม่เกิน 2 ตำแหน่ง */
export function validateMaxScore(raw: string): { value?: number; error?: string } {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return { error: "คะแนนเต็มต้องเป็นตัวเลขมากกว่า 0" };
  if (value > 1000) return { error: "คะแนนเต็มสูงผิดปกติ" };
  if (Math.round(value * 100) !== value * 100) return { error: "ทศนิยมได้ไม่เกิน 2 ตำแหน่ง" };
  return { value };
}
