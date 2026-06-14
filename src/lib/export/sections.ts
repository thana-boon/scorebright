/** ส่วนของไฟล์ SchoolBright ที่เลือก export ได้ (ใช้ได้ทั้ง client และ server) */

export const EXPORT_SECTIONS = [
  "ratio",
  "beforeMid",
  "mid",
  "afterMid",
  "final",
  "behavior",
  "readWrite",
  "competency",
] as const;

export type ExportSection = (typeof EXPORT_SECTIONS)[number];

export const SECTION_LABELS: Record<ExportSection, string> = {
  ratio: "สัดส่วนคะแนน + % ตัดผ่าน",
  beforeMid: "คะแนนเก็บก่อนกลางภาค",
  mid: "สอบกลางภาค",
  afterMid: "คะแนนเก็บหลังกลางภาค",
  final: "สอบปลายภาค",
  behavior: "คุณลักษณะอันพึงประสงค์",
  readWrite: "อ่านคิดวิเคราะห์",
  competency: "สมรรถนะ",
};

/** แปลง query param "sections=mid,readWrite" → Set (ไม่ส่ง/ส่งผิด = เอาทั้งหมด) */
export function parseSections(param: string | null): Set<ExportSection> {
  if (!param) return new Set(EXPORT_SECTIONS);
  const valid = new Set<string>(EXPORT_SECTIONS);
  const picked = param.split(",").filter((s): s is ExportSection => valid.has(s));
  return picked.length > 0 ? new Set(picked) : new Set(EXPORT_SECTIONS);
}
