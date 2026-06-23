/**
 * Export engine — สร้างไฟล์ import SchoolBright จาก template จริง
 * Logic ทั้งหมดพิสูจน์กับการ import เข้า SchoolBright จริงแล้ว (Phase 1 spike):
 *
 * 1. เขียนข้อมูลทับลง sheet ที่มองเห็น (เคลียร์ demo ออกหมด)
 * 2. สูตรทุกตัวในไฟล์ผลลัพธ์ถูกแทนด้วยค่า literal ที่คำนวณใน TS
 *    (ExcelJS ไม่ recalculate และ SchoolBright อ่าน cached value)
 * 3. ค่าใน sheet ลับ สำหรับdev1/dev2 ไม่ hardcode — อ่านสูตรจริงจากเซลล์ template
 *    แล้ว resolve กับค่าที่เพิ่งเขียน (สูตรรูปแบบไม่รู้จัก = throw ทันที กันส่งค่าผิดเงียบ ๆ)
 */
import ExcelJS from "exceljs";
import path from "node:path";

export const TEMPLATE_PATH = path.resolve(
  process.cwd(),
  "templates",
  "Import score version 1.5.1.xlsx",
);

export const SHEET = {
  ratio: "ตั้งค่าสัดส่วนคะแนน",
  beforeMid: "คะแนนเก็บ",
  mid: "กลางภาค",
  afterMid: "คะแนนเก็บหลังกลางภาค",
  final: "ปลายภาค",
  behavior: "คุณลักษณะอันพึงประสงค์",
  readWrite: "อ่านคิดวิเคราะห์",
  competency: "สมรรถนะ",
  dev1: "สำหรับdev1",
  dev2: "สำหรับdev2",
} as const;

const STUDENT_ROW_START = 5;
const STUDENT_ROW_END = 64; // limit 60 คน/ไฟล์
const MAX_ROW = 4;
const HEADER_ROW = 3;

export const ROOM_LIMIT = STUDENT_ROW_END - STUDENT_ROW_START + 1;

// ---------- รูปแบบข้อมูลเข้า ----------

export interface ExportItem {
  name: string;
  max: number;
}

export interface ExportStudent {
  no: number;
  code: string;
  fullName: string;
  beforeMid: (number | null)[];
  mid: (number | null)[];
  afterMid: (number | null)[];
  final: (number | null)[];
  behavior: (number | null)[]; // 20 ช่อง ตรงคอลัมน์ D:W
  readWrite: (number | null)[]; // 5 ช่อง D:H
  competency: (number | null)[]; // 10 ช่อง D:M
}

export interface ExportData {
  /** null = ไม่ export ส่วนสัดส่วน — ปล่อยชีทตั้งค่าว่างตาม template */
  ratios: {
    beforeMid: number;
    mid: number;
    afterMid: number;
    final: number;
    passPercent: number;
  } | null;
  beforeMidItems: ExportItem[];
  midItems: ExportItem[];
  afterMidItems: ExportItem[];
  finalItems: ExportItem[];
  students: ExportStudent[]; // เรียงเลขที่ ≤ 60 คน
}

// ---------- helpers ----------

function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
const COL_D = 4;

function sumOrBlank(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100;
}

/** เลียนแบบ IFERROR(MAX(MODE.MULT(range)),"") ของ template */
export function modeMaxOrBlank(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  const freq = new Map<number, number>();
  for (const v of nums) freq.set(v, (freq.get(v) ?? 0) + 1);
  let best = 0;
  for (const c of freq.values()) best = Math.max(best, c);
  if (best < 2) return null;
  let result: number | null = null;
  for (const [v, c] of freq) if (c === best && (result === null || v > result)) result = v;
  return result;
}

type Cellish = ExcelJS.CellValue;
function setCell(ws: ExcelJS.Worksheet, addr: string, value: Cellish) {
  ws.getCell(addr).value = value;
}

// ---------- sheet คะแนน 4 ช่วง ----------

function writeScoreSheet(
  ws: ExcelJS.Worksheet,
  items: ExportItem[],
  students: ExportStudent[],
  getScores: (s: ExportStudent) => (number | null)[],
  scoreColCount: number, // 20 (D:W) หรือ 10 (D:M)
  sumCol: string,
  hasDemoHeader = false, // ชีทคะแนนเก็บมี demo "ตัวอย่าง"/10 ที่ D3/D4 — ต้องเคลียร์แม้ไม่มีหัวข้อ
) {
  if (items.length > scoreColCount) {
    throw new Error(`sheet "${ws.name}" รองรับ ${scoreColCount} หัวข้อ แต่ได้ ${items.length}`);
  }

  if (hasDemoHeader && items.length === 0) {
    // หัวข้อ "ตัวอย่าง" → เติมเลข 1 (เลขลำดับคอลัมน์แรก ตามแบบคอลัมน์ถัดไป 2,3,4…) แทนการเคลียร์
    setCell(ws, `D${HEADER_ROW}`, 1);
    // คะแนนเต็ม (10) ยังเอาออกเหมือนเดิม
    setCell(ws, `D${MAX_ROW}`, null);
  }

  // หัวข้อ + คะแนนเต็ม เฉพาะช่องที่ใช้ (ช่องอื่นคง placeholder ของ template — ไฟล์กรอกมือจริงก็เป็นแบบนี้)
  items.forEach((item, i) => {
    const col = colLetter(COL_D + i);
    setCell(ws, `${col}${HEADER_ROW}`, String(item.name)); // text เสมอ กัน formula injection
    setCell(ws, `${col}${MAX_ROW}`, item.max);
  });
  setCell(ws, `${sumCol}${MAX_ROW}`, sumOrBlank(items.map((i) => i.max)));

  for (let r = STUDENT_ROW_START; r <= STUDENT_ROW_END; r++) {
    const s = students[r - STUDENT_ROW_START];
    // A/B/C — แทนทั้ง demo และสูตรลิงก์ข้าม sheet ด้วยค่าจริง
    setCell(ws, `A${r}`, s ? s.no : null);
    setCell(ws, `B${r}`, s ? String(s.code) : null);
    setCell(ws, `C${r}`, s ? String(s.fullName) : null);
    for (let i = 0; i < scoreColCount; i++) {
      const col = colLetter(COL_D + i);
      const v = s && i < items.length ? getScores(s)[i] ?? null : null;
      setCell(ws, `${col}${r}`, v);
    }
    const rowScores = s ? getScores(s).slice(0, items.length) : [];
    setCell(ws, `${sumCol}${r}`, s ? sumOrBlank(rowScores) : null);
  }
}

// ---------- sheet คุณลักษณะ / อ่านคิด / สมรรถนะ ----------

function writeTraitSheet(
  ws: ExcelJS.Worksheet,
  students: ExportStudent[],
  getScores: (s: ExportStudent) => (number | null)[],
  colCount: number, // 20 / 5 / 10
  sumCol: string,
) {
  // คะแนนเต็ม: ช่องที่ template เติม 3 ไว้แล้วคงเดิม / ช่องสำรองที่มีการกรอกคะแนน → เติม 3 ให้
  // (ตามคำเตือนใน template: "คะแนนเต็มต้องตรงกับหน้าบันทึกคะแนน")
  const maxRowValues: (number | null)[] = [];
  for (let i = 0; i < colCount; i++) {
    const col = colLetter(COL_D + i);
    const existing = ws.getCell(`${col}${MAX_ROW}`).value;
    const columnUsed = students.some((s) => getScores(s)[i] !== null);
    if (typeof existing === "number") {
      maxRowValues.push(existing);
    } else if (columnUsed) {
      setCell(ws, `${col}${MAX_ROW}`, 3);
      maxRowValues.push(3);
    } else {
      maxRowValues.push(null);
    }
  }
  setCell(ws, `${sumCol}${MAX_ROW}`, modeMaxOrBlank(maxRowValues));

  for (let r = STUDENT_ROW_START; r <= STUDENT_ROW_END; r++) {
    const s = students[r - STUDENT_ROW_START];
    setCell(ws, `A${r}`, s ? s.no : null);
    setCell(ws, `B${r}`, s ? String(s.code) : null);
    setCell(ws, `C${r}`, s ? String(s.fullName) : null);
    for (let i = 0; i < colCount; i++) {
      setCell(ws, `${colLetter(COL_D + i)}${r}`, s ? getScores(s)[i] ?? null : null);
    }
    setCell(ws, `${sumCol}${r}`, s ? modeMaxOrBlank(getScores(s)) : null);
  }
}

// ---------- แทนสูตร dev sheets ด้วยค่าจริง (parse สูตรจาก template) ----------

function getFormulaText(cell: ExcelJS.Cell): string | null {
  const v = cell.value;
  if (v && typeof v === "object" && "formula" in v && v.formula) return v.formula;
  return null;
}

function resolveRef(wb: ExcelJS.Workbook, ref: string): Cellish {
  const [sheetName, addr] = ref.split("!");
  const ws = wb.getWorksheet(sheetName);
  if (!ws) throw new Error(`ไม่พบ sheet "${sheetName}" จาก ref "${ref}"`);
  const v = ws.getCell(addr).value;
  if (v && typeof v === "object") throw new Error(`ref "${ref}" ยังเป็นสูตร/ค่า object อยู่`);
  return v ?? null;
}

function toNum(v: Cellish): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`แปลงค่า "${v}" เป็นตัวเลขไม่ได้`);
  return n;
}

const REF = String.raw`[^!+=,()"']+![A-Z]{1,3}\d+`;
const RE_IF_ZERO = new RegExp(`^IF\\((${REF})=0,"",(${REF})\\)$`);
const RE_IF_BLANK = new RegExp(`^IF\\((${REF})="","",(${REF})\\)$`);
const RE_PAREN_SUM = new RegExp(`^\\((${REF})\\+(${REF})\\)$`);
const RE_SUM = new RegExp(`^SUM\\((${REF})\\+(${REF})\\)$`);
const RE_PLAIN = new RegExp(`^(${REF})$`);

function evalDevFormula(wb: ExcelJS.Workbook, formula: string): Cellish {
  let m: RegExpMatchArray | null;
  if ((m = formula.match(RE_IF_ZERO))) {
    const v = resolveRef(wb, m[1]);
    return v === null || v === 0 ? null : v;
  }
  if ((m = formula.match(RE_IF_BLANK))) {
    const v = resolveRef(wb, m[1]);
    return v === null || v === "" ? null : v;
  }
  if ((m = formula.match(RE_PAREN_SUM)) || (m = formula.match(RE_SUM))) {
    const a = resolveRef(wb, m[1]);
    const b = resolveRef(wb, m[2]);
    // ว่างทั้งคู่ = ส่วนนั้นไม่ได้ export — ให้ว่างไว้ (อย่าส่ง 0 ไปทับค่าใน SchoolBright)
    if ((a === null || a === "") && (b === null || b === "")) return null;
    return toNum(a) + toNum(b);
  }
  if ((m = formula.match(RE_PLAIN))) {
    return resolveRef(wb, m[1]);
  }
  throw new Error(`สูตรใน dev sheet รูปแบบไม่รู้จัก: ${formula}`);
}

function literalizeDevSheet(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet) {
  for (let r = 1; r <= ws.rowCount; r++) {
    ws.getRow(r).eachCell({ includeEmpty: false }, (cell) => {
      const f = getFormulaText(cell);
      if (f) cell.value = evalDevFormula(wb, f);
    });
  }
}

// ---------- entry point ----------

export async function buildWorkbook(data: ExportData): Promise<ExcelJS.Workbook> {
  if (data.students.length > ROOM_LIMIT) {
    throw new Error(`นักเรียนเกิน ${ROOM_LIMIT} คน/ไฟล์ (${data.students.length} คน)`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);
  for (const name of Object.values(SHEET)) {
    if (!wb.getWorksheet(name)) throw new Error(`template ไม่มี sheet "${name}"`);
  }

  if (data.ratios) {
    const wsRatio = wb.getWorksheet(SHEET.ratio)!;
    setCell(wsRatio, "A3", data.ratios.beforeMid);
    setCell(wsRatio, "B3", data.ratios.mid);
    setCell(wsRatio, "C3", data.ratios.afterMid);
    setCell(wsRatio, "D3", data.ratios.final);
    setCell(wsRatio, "E3", data.ratios.passPercent);
  }

  const st = data.students;
  writeScoreSheet(wb.getWorksheet(SHEET.beforeMid)!, data.beforeMidItems, st, (s) => s.beforeMid, 20, "X", true);
  writeScoreSheet(wb.getWorksheet(SHEET.mid)!, data.midItems, st, (s) => s.mid, 10, "N");
  writeScoreSheet(wb.getWorksheet(SHEET.afterMid)!, data.afterMidItems, st, (s) => s.afterMid, 20, "X");
  writeScoreSheet(wb.getWorksheet(SHEET.final)!, data.finalItems, st, (s) => s.final, 10, "N");

  writeTraitSheet(wb.getWorksheet(SHEET.behavior)!, st, (s) => s.behavior, 20, "X");
  writeTraitSheet(wb.getWorksheet(SHEET.readWrite)!, st, (s) => s.readWrite, 5, "I");
  writeTraitSheet(wb.getWorksheet(SHEET.competency)!, st, (s) => s.competency, 10, "N");

  literalizeDevSheet(wb, wb.getWorksheet(SHEET.dev1)!);
  literalizeDevSheet(wb, wb.getWorksheet(SHEET.dev2)!);

  wb.calcProperties.fullCalcOnLoad = true;
  return wb;
}
