/**
 * Phase 1 spike: สร้างไฟล์ import SchoolBright จาก template จริง
 *
 * หลักการ:
 * 1. โหลด template แล้วเขียนข้อมูลจริงทับลง sheet ที่มองเห็น (เคลียร์ demo ออกหมด)
 * 2. สูตรทุกตัวในไฟล์ผลลัพธ์ถูกแทนด้วยค่า literal ที่คำนวณใน TS
 *    เพราะ ExcelJS ไม่ recalculate และ SchoolBright อาจอ่าน cached value
 * 3. ค่าใน sheet สำหรับdev1/dev2 ไม่ได้ hardcode map — อ่านสูตรจริงจากเซลล์
 *    ใน template แล้ว resolve กับค่าที่เราเพิ่งเขียน (กันพลาดถ้าเข้าใจ map ผิด)
 * 4. เซฟแล้วเปิดไฟล์กลับมาตรวจค่าสำคัญซ้ำอีกรอบ (self-check)
 *
 * ใช้: npm run spike-export → ได้ไฟล์ out/ว22101_ม.2-1_เทอม1-2569.xlsx
 */
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";

const TEMPLATE_PATH = path.resolve(
  __dirname,
  "..",
  "templates",
  "Import score version 1.5.1.xlsx",
);
const OUT_DIR = path.resolve(__dirname, "..", "out");
const OUT_FILE = path.join(OUT_DIR, "ว22101_ม.2-1_เทอม1-2569.xlsx");

// ---------- ชื่อ sheet ตาม template (ห้ามเปลี่ยน) ----------
const SHEET = {
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
const STUDENT_ROW_END = 64; // 60 คน
const MAX_ROW = 4; // แถวคะแนนเต็ม
const HEADER_ROW = 3; // แถวชื่อหัวข้อ

// ---------- ข้อมูลสมมุติของ spike ----------
interface ScoreItem {
  name: string;
  max: number;
}
interface SpikeStudent {
  no: number;
  code: string;
  fullName: string;
  beforeMid: (number | null)[];
  mid: (number | null)[];
  afterMid: (number | null)[];
  final: (number | null)[];
  behavior: (number | null)[]; // 8 ข้อ 0-3
  readWrite: (number | null)[]; // 3 ข้อ 0-3
  competency: (number | null)[]; // 5 ข้อ 0-3
}

const ratios = { beforeMid: 30, mid: 20, afterMid: 20, final: 30, passPercent: 50 };

const beforeMidItems: ScoreItem[] = [
  { name: "งานครั้งที่ 1", max: 10 },
  { name: "งานครั้งที่ 2", max: 10 },
  { name: "สอบย่อยครั้งที่ 1", max: 10 },
];
const midItems: ScoreItem[] = [{ name: "สอบกลางภาค", max: 20 }];
const afterMidItems: ScoreItem[] = [{ name: "งานหลังกลางภาค", max: 20 }];
const finalItems: ScoreItem[] = [{ name: "สอบปลายภาค", max: 30 }];

// นักเรียนจริงสำหรับทดสอบ import — รอบนี้กรอกคะแนนครบทุกช่อง
// เพื่อตัดตัวแปรอื่นออก เหลือตัวแปรเดียวคือรหัสนักเรียนตรงกับฐานข้อมูล SchoolBright
const students: SpikeStudent[] = [
  {
    no: 1, code: "4650", fullName: "เด็กชายกันตณัฐ ชื่นเจริญ",
    beforeMid: [8, 9, 7], mid: [15], afterMid: [18], final: [25],
    behavior: [3, 3, 3, 2, 3, 3, 3, 3], readWrite: [3, 3, 2], competency: [3, 3, 3, 2, 3],
  },
  {
    no: 2, code: "4653", fullName: "เด็กชายเดชากิตติ์ แก้วประเสริฐ",
    beforeMid: [8.5, 7, 9], mid: [12.5], afterMid: [15], final: [22],
    behavior: [2, 2, 3, 2, 2, 3, 2, 2], readWrite: [2, 2, 3], competency: [2, 2, 3, 2, 2],
  },
  {
    no: 3, code: "4664", fullName: "เด็กชายณัฐพัชร์ ผิวเกลี้ยง",
    beforeMid: [6, 5, 8], mid: [10], afterMid: [12], final: [18],
    behavior: [2, 3, 2, 2, 1, 2, 3, 2], readWrite: [2, 2, 3], competency: [2, 3, 2, 2, 2],
  },
  {
    no: 4, code: "5043", fullName: "เด็กชายกันตเมศฐ์ ศรีเทพเอี่ยม",
    beforeMid: [10, 10, 10], mid: [20], afterMid: [20], final: [30],
    behavior: [3, 3, 3, 3, 3, 3, 3, 3], readWrite: [3, 3, 3], competency: [3, 3, 3, 3, 3],
  },
  {
    no: 5, code: "5044", fullName: "เด็กชายปลายภพ ตั้งสุทธิวงษ์",
    beforeMid: [7, 8, 6], mid: [11], afterMid: [14], final: [21],
    behavior: [2, 2, 2, 3, 2, 2, 2, 3], readWrite: [2, 3, 2], competency: [2, 2, 3, 2, 2],
  },
];

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
function colNumber(letter: string): number {
  let n = 0;
  for (const ch of letter) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** รวมคะแนน: ถ้าว่างทุกช่องคืน null (เทียบเท่า "" ของสูตร IF(ISBLANK..)) */
function sumOrBlank(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0);
}

/** เลียนแบบ IFERROR(MAX(MODE.MULT(range)),"") — ค่าฐานนิยมตัวมากสุด, ไม่มีค่าซ้ำเลยคืน null */
function modeMaxOrBlank(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  const freq = new Map<number, number>();
  for (const v of nums) freq.set(v, (freq.get(v) ?? 0) + 1);
  let best = 0;
  for (const c of freq.values()) best = Math.max(best, c);
  if (best < 2) return null; // MODE ต้องมีค่าซ้ำอย่างน้อย 1 คู่
  let result: number | null = null;
  for (const [v, c] of freq) {
    if (c === best && (result === null || v > result)) result = v;
  }
  return result;
}

type Cellish = ExcelJS.CellValue;
function setCell(ws: ExcelJS.Worksheet, addr: string, value: Cellish) {
  ws.getCell(addr).value = value;
}

// ---------- เขียน sheet คะแนน (คะแนนเก็บ / กลางภาค / หลังกลางภาค / ปลายภาค) ----------
function writeScoreSheet(
  ws: ExcelJS.Worksheet,
  items: ScoreItem[],
  getScores: (s: SpikeStudent) => (number | null)[],
  scoreColCount: number, // 20 (D..W) หรือ 10 (D..M)
  sumCol: string, // "X" หรือ "N"
) {
  const firstScoreCol = colNumber("D");
  if (items.length > scoreColCount) {
    throw new Error(`sheet "${ws.name}" รองรับ ${scoreColCount} หัวข้อ แต่ได้ ${items.length}`);
  }

  // แถวหัวข้อ + คะแนนเต็ม: เขียนเฉพาะช่องที่ใช้ ช่องอื่นคงค่า placeholder ของ template ไว้
  // ยกเว้นช่องแรกของ "คะแนนเก็บ" ที่เป็น demo ("ตัวอย่าง"/10) ซึ่งถูกหัวข้อจริงทับอยู่แล้ว
  items.forEach((item, i) => {
    const col = colLetter(firstScoreCol + i);
    setCell(ws, `${col}${HEADER_ROW}`, String(item.name)); // ชื่อเป็น text เสมอ กัน formula injection
    setCell(ws, `${col}${MAX_ROW}`, item.max);
  });

  // คอลัมน์ A/B/C (เลขที่/รหัส/ชื่อ): เขียน literal ทับทุกแถว — แถวที่เป็นสูตรลิงก์
  // ใน template จะถูกแทนด้วยค่าจริง แถวเกินจำนวนนักเรียนเคลียร์เป็นว่าง (ลบ demo 123/456/A123 ไปด้วย)
  for (let r = STUDENT_ROW_START; r <= STUDENT_ROW_END; r++) {
    const s = students[r - STUDENT_ROW_START];
    setCell(ws, `A${r}`, s ? s.no : null);
    setCell(ws, `B${r}`, s ? String(s.code) : null);
    setCell(ws, `C${r}`, s ? String(s.fullName) : null);
    // ช่องคะแนน
    for (let i = 0; i < scoreColCount; i++) {
      const col = colLetter(firstScoreCol + i);
      const v = s && i < items.length ? getScores(s)[i] ?? null : null;
      setCell(ws, `${col}${r}`, v);
    }
    // คอลัมน์รวม (แทนสูตร SUM)
    const rowScores = s ? getScores(s).slice(0, items.length) : [];
    setCell(ws, `${sumCol}${r}`, s ? sumOrBlank(rowScores) : null);
  }
  // รวมของแถวคะแนนเต็ม
  setCell(ws, `${sumCol}${MAX_ROW}`, sumOrBlank(items.map((i) => i.max)));
}

// ---------- เขียน sheet เชิงคุณลักษณะ (คุณลักษณะฯ / อ่านคิดฯ / สมรรถนะ) ----------
function writeTraitSheet(
  ws: ExcelJS.Worksheet,
  getScores: (s: SpikeStudent) => (number | null)[],
  usedColCount: number, // 8 / 3 / 5
  sumCol: string, // "X" / "I" / "N"
) {
  const firstScoreCol = colNumber("D");
  // หัวข้อ + คะแนนเต็มของ sheet พวกนี้ template กำหนดมาแล้ว (เต็ม 3) — ไม่แตะ
  const maxRowValues: (number | null)[] = [];
  for (let i = 0; i < usedColCount; i++) {
    const v = ws.getCell(`${colLetter(firstScoreCol + i)}${MAX_ROW}`).value;
    maxRowValues.push(typeof v === "number" ? v : null);
  }
  setCell(ws, `${sumCol}${MAX_ROW}`, modeMaxOrBlank(maxRowValues));

  for (let r = STUDENT_ROW_START; r <= STUDENT_ROW_END; r++) {
    const s = students[r - STUDENT_ROW_START];
    setCell(ws, `A${r}`, s ? s.no : null);
    setCell(ws, `B${r}`, s ? String(s.code) : null);
    setCell(ws, `C${r}`, s ? String(s.fullName) : null);
    for (let i = 0; i < usedColCount; i++) {
      const col = colLetter(firstScoreCol + i);
      setCell(ws, `${col}${r}`, s ? getScores(s)[i] ?? null : null);
    }
    setCell(ws, `${sumCol}${r}`, s ? modeMaxOrBlank(getScores(s)) : null);
  }
}

// ---------- แทนสูตรใน dev sheets ด้วยค่าที่คำนวณจากสูตรจริงของ template ----------
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
    return toNum(resolveRef(wb, m[1])) + toNum(resolveRef(wb, m[2]));
  }
  if ((m = formula.match(RE_PLAIN))) {
    return resolveRef(wb, m[1]);
  }
  throw new Error(`สูตรใน dev sheet รูปแบบไม่รู้จัก: ${formula}`);
}

function literalizeDevSheet(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet) {
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    row.eachCell({ includeEmpty: false }, (cell) => {
      const f = getFormulaText(cell);
      if (f) cell.value = evalDevFormula(wb, f);
    });
  }
}

// ---------- main ----------
async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);

  for (const name of Object.values(SHEET)) {
    if (!wb.getWorksheet(name)) throw new Error(`template ไม่มี sheet "${name}"`);
  }

  // 1) สัดส่วนคะแนน (A3:E3 = เก็บก่อนกลาง, กลางภาค, เก็บหลังกลาง, ปลายภาค, %ตัดผ่าน)
  const wsRatio = wb.getWorksheet(SHEET.ratio)!;
  setCell(wsRatio, "A3", ratios.beforeMid);
  setCell(wsRatio, "B3", ratios.mid);
  setCell(wsRatio, "C3", ratios.afterMid);
  setCell(wsRatio, "D3", ratios.final);
  setCell(wsRatio, "E3", ratios.passPercent);

  // 2) sheet คะแนน 4 ช่วง
  writeScoreSheet(wb.getWorksheet(SHEET.beforeMid)!, beforeMidItems, (s) => s.beforeMid, 20, "X");
  writeScoreSheet(wb.getWorksheet(SHEET.mid)!, midItems, (s) => s.mid, 10, "N");
  writeScoreSheet(wb.getWorksheet(SHEET.afterMid)!, afterMidItems, (s) => s.afterMid, 20, "X");
  writeScoreSheet(wb.getWorksheet(SHEET.final)!, finalItems, (s) => s.final, 10, "N");

  // 3) sheet คุณลักษณะ / อ่านคิดวิเคราะห์ / สมรรถนะ
  writeTraitSheet(wb.getWorksheet(SHEET.behavior)!, (s) => s.behavior, 8, "X");
  writeTraitSheet(wb.getWorksheet(SHEET.readWrite)!, (s) => s.readWrite, 3, "I");
  writeTraitSheet(wb.getWorksheet(SHEET.competency)!, (s) => s.competency, 5, "N");

  // 4) dev sheets: คำนวณจากสูตรจริงของ template แล้วเขียนทับเป็น literal
  literalizeDevSheet(wb, wb.getWorksheet(SHEET.dev1)!);
  literalizeDevSheet(wb, wb.getWorksheet(SHEET.dev2)!);

  // เผื่อมีสูตรหลงเหลือที่จุดอื่น ให้ Excel คำนวณใหม่ตอนเปิด
  wb.calcProperties.fullCalcOnLoad = true;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await wb.xlsx.writeFile(OUT_FILE);
  console.log(`เขียนไฟล์แล้ว: ${OUT_FILE}`);

  await verify();
}

// ---------- เปิดไฟล์ที่เซฟแล้วตรวจค่าสำคัญซ้ำ ----------
async function verify() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(OUT_FILE);

  let failures = 0;
  function expect(sheet: string, addr: string, expected: Cellish, label: string) {
    const actual = wb.getWorksheet(sheet)!.getCell(addr).value ?? null;
    const ok =
      actual === expected ||
      (typeof actual === "number" && typeof expected === "number" && Math.abs(actual - expected) < 1e-9);
    if (!ok) {
      failures++;
      console.log(`  FAIL ${label}: ${sheet}!${addr} = ${JSON.stringify(actual)} (คาด ${JSON.stringify(expected)})`);
    } else {
      console.log(`  ok   ${label}: ${sheet}!${addr} = ${JSON.stringify(actual)}`);
    }
  }

  console.log("\nตรวจไฟล์ผลลัพธ์:");
  // สัดส่วน
  expect(SHEET.ratio, "A3", 30, "สัดส่วนเก็บก่อนกลาง");
  expect(SHEET.ratio, "E3", 50, "% ตัดผ่าน");
  // dev1
  expect(SHEET.dev1, "A2", 50, "fRatioQuiz (ก่อน+หลัง)");
  expect(SHEET.dev1, "B2", 30, "fRatioBeforeMidTerm");
  expect(SHEET.dev1, "C2", 20, "fRatioAfterMidTerm");
  expect(SHEET.dev1, "D2", 20, "fRatioMidTerm");
  expect(SHEET.dev1, "E2", 30, "fRatioLateTerm");
  expect(SHEET.dev1, "F2", 50, "fRatioQuizPass");
  expect(SHEET.dev1, "G2", 10, "maxGrade1");
  expect(SHEET.dev1, "I2", 10, "maxGrade3");
  expect(SHEET.dev1, "J2", null, "maxGrade4 (ไม่ใช้ → ว่าง)");
  expect(SHEET.dev1, "AA2", "งานครั้งที่ 1", "nameGrade1");
  expect(SHEET.dev1, "AC2", "สอบย่อยครั้งที่ 1", "nameGrade3");
  expect(SHEET.dev1, "AU2", 20, "maxCheewat1 (เก็บหลังกลาง)");
  expect(SHEET.dev1, "BO2", "งานหลังกลางภาค", "nameCheewat1");
  expect(SHEET.dev1, "CI2", 3, "maxBehavior1");
  expect(SHEET.dev1, "DW2", 20, "maxMid1");
  expect(SHEET.dev1, "EG2", 30, "maxFinal1");
  expect(SHEET.dev1, "EQ2", 30, "maxBeforeMidTermTotal");
  expect(SHEET.dev1, "ER2", 20, "maxAfterMidTermTotal");
  expect(SHEET.dev1, "ES2", 50, "maxgradetotal (เคยเป็น #VALUE! ใน template)");
  expect(SHEET.dev1, "ET2", 20, "maxmidtotal");
  expect(SHEET.dev1, "EU2", 30, "maxfinaltotal");
  expect(SHEET.dev1, "EV2", 3, "maxReadWrite1");
  expect(SHEET.dev1, "FF2", 3, "maxSamattana1");
  // dev2 — นักเรียนคนที่ 1 (แถว 2) และคนอื่น ๆ
  expect(SHEET.dev2, "A2", "4650", "stdSID คนที่ 1");
  expect(SHEET.dev2, "B2", 8, "scoreGrade1 คนที่ 1");
  expect(SHEET.dev2, "D2", 7, "scoreGrade3 คนที่ 1");
  expect(SHEET.dev2, "V2", 18, "scoreCheewat1 คนที่ 1");
  expect(SHEET.dev2, "AZ2", 15, "scoreMid1 คนที่ 1");
  expect(SHEET.dev2, "BJ2", 25, "scoreFinal1 คนที่ 1");
  expect(SHEET.dev2, "BT2", 15, "scoreMidTermSUM คนที่ 1");
  expect(SHEET.dev2, "BU2", 25, "scoreFinalTermSUM คนที่ 1");
  expect(SHEET.dev2, "BV2", 3, "scoreBahaviorSUM คนที่ 1 (ฐานนิยม)");
  expect(SHEET.dev2, "BW2", 3, "getReadWrite คนที่ 1 (ฐานนิยม)");
  expect(SHEET.dev2, "BX2", 3, "scoreSamatana คนที่ 1 (ฐานนิยม)");
  expect(SHEET.dev2, "A3", "4653", "stdSID คนที่ 2");
  expect(SHEET.dev2, "B3", 8.5, "scoreGrade1 คนที่ 2 (ทศนิยม)");
  expect(SHEET.dev2, "A6", "5044", "stdSID คนที่ 5");
  expect(SHEET.dev2, "BJ6", 21, "scoreFinal1 คนที่ 5");
  expect(SHEET.dev2, "A7", null, "แถวที่ 6 ไม่มีนักเรียน → ว่าง");
  // demo เก่าต้องหายหมด
  expect(SHEET.beforeMid, "B7", "4664", "แถว demo A123 ถูกแทนด้วยนักเรียนจริง");
  expect(SHEET.beforeMid, "C8", "เด็กชายกันตเมศฐ์ ศรีเทพเอี่ยม", "ชื่อนักเรียนคนที่ 4");
  expect(SHEET.beforeMid, "D3", "งานครั้งที่ 1", "หัวข้อ demo 'ตัวอย่าง' ถูกแทน");
  expect(SHEET.beforeMid, "X5", 24, "รวมคะแนนเก็บ คนที่ 1");
  expect(SHEET.beforeMid, "X9", 21, "รวมคะแนนเก็บ คนที่ 5");
  expect(SHEET.afterMid, "B5", "4650", "B ของหลังกลางภาค (เคยเป็นสูตรลิงก์)");
  expect(SHEET.mid, "C5", "เด็กชายกันตณัฐ ชื่นเจริญ", "C ของกลางภาค (เคยเป็นสูตรลิงก์)");

  // ไม่ควรเหลือสูตรใน dev sheets เลย
  for (const name of [SHEET.dev1, SHEET.dev2] as string[]) {
    const ws = wb.getWorksheet(name)!;
    let remaining = 0;
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        const v = cell.value;
        if (v && typeof v === "object" && ("formula" in v || "sharedFormula" in v)) remaining++;
      });
    });
    if (remaining > 0) {
      failures++;
      console.log(`  FAIL sheet "${name}" ยังเหลือสูตร ${remaining} เซลล์`);
    } else {
      console.log(`  ok   sheet "${name}" ไม่เหลือสูตรค้าง`);
    }
  }

  console.log(failures === 0 ? "\nผ่านทุกข้อ ✔" : `\nไม่ผ่าน ${failures} ข้อ ✘`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
