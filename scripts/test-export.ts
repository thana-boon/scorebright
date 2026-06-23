/**
 * Unit test ของ export engine: สร้างไฟล์จากข้อมูลสมมุติแล้วเทียบเซลล์สำคัญกับ expected
 * ครอบคลุม: สัดส่วน, หัวข้อ/คะแนนเต็ม, คะแนนรายคน, ทศนิยม, ช่องว่าง, ฐานนิยม,
 * ช่องสำรองของคุณลักษณะฯ (9-20), dev1/dev2, ไม่เหลือสูตรค้าง, โครง sheet ครบ
 *
 * ใช้: npm run test:export
 */
import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import {
  buildWorkbook,
  SHEET,
  type ExportData,
  type ExportStudent,
} from "../src/lib/export/build-workbook";

const OUT = path.resolve(__dirname, "..", "out", "test-export.xlsx");

function student(partial: Partial<ExportStudent> & Pick<ExportStudent, "no" | "code" | "fullName">): ExportStudent {
  return {
    beforeMid: [],
    mid: [],
    afterMid: [],
    final: [],
    behavior: Array(20).fill(null),
    readWrite: Array(5).fill(null),
    competency: Array(10).fill(null),
    ...partial,
  };
}

const data: ExportData = {
  ratios: { beforeMid: 30, mid: 20, afterMid: 20, final: 30, passPercent: 50 },
  beforeMidItems: [
    { name: "งานครั้งที่ 1", max: 10 },
    { name: "งานครั้งที่ 2", max: 10 },
    { name: "สอบย่อย", max: 10 },
  ],
  midItems: [{ name: "สอบกลางภาค", max: 20 }],
  afterMidItems: [{ name: "งานหลังกลางภาค", max: 20 }],
  finalItems: [{ name: "สอบปลายภาค", max: 30 }],
  students: [
    student({
      no: 1, code: "4650", fullName: "เด็กชายหนึ่ง ทดสอบ",
      beforeMid: [8, 9, 7], mid: [15], afterMid: [18], final: [25],
      behavior: [3, 3, 3, 2, 3, 3, 3, 3, ...Array(12).fill(null)],
      readWrite: [3, 3, 2, null, null],
      competency: [3, 3, 3, 2, 3, ...Array(5).fill(null)],
    }),
    student({
      no: 2, code: "4651", fullName: "เด็กหญิงสอง ทศนิยม",
      beforeMid: [8.5, 7, 9], mid: [12.5], afterMid: [15], final: [22],
      behavior: [2, 2, 3, 2, 2, 3, 2, 2, 1, ...Array(11).fill(null)], // ใช้ช่องสำรองที่ 9 ด้วย
      readWrite: [1, 2, 3, null, null], // ไม่มีฐานนิยม → ว่าง
      competency: [2, 2, 3, 2, 2, ...Array(5).fill(null)],
    }),
    student({
      no: 3, code: "4652", fullName: "เด็กชายสาม ยังไม่ครบ",
      beforeMid: [7, null, 6], mid: [11], afterMid: [14], final: [null],
      behavior: [2, 2, 2, 3, 2, 2, 2, 3, ...Array(12).fill(null)],
      readWrite: [2, 3, 2, null, null],
      competency: [2, 2, 3, 2, 2, ...Array(5).fill(null)],
    }),
  ],
};

async function main() {
  const wb = await buildWorkbook(data);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);

  // อ่านกลับมาตรวจ
  const rb = new ExcelJS.Workbook();
  await rb.xlsx.readFile(OUT);

  let failures = 0;
  const expect = (sheet: string, addr: string, expected: ExcelJS.CellValue, label: string) => {
    const actual = rb.getWorksheet(sheet)!.getCell(addr).value ?? null;
    const ok =
      actual === expected ||
      (typeof actual === "number" && typeof expected === "number" && Math.abs(actual - expected) < 1e-9);
    console.log(`  ${ok ? "ok  " : "FAIL"} ${label}: ${sheet}!${addr} = ${JSON.stringify(actual)}${ok ? "" : ` (คาด ${JSON.stringify(expected)})`}`);
    if (!ok) failures++;
  };

  // โครง sheet ครบ 12 + สถานะ hidden เดิม
  const states = rb.worksheets.map((w) => `${w.name}:${w.state}`).join(",");
  const structOk =
    rb.worksheets.length === 12 && states.includes("สำหรับdev1:hidden") && states.includes("สำหรับdev2:hidden");
  console.log(`  ${structOk ? "ok  " : "FAIL"} โครง 12 sheets + dev hidden`);
  if (!structOk) failures++;

  expect(SHEET.ratio, "A3", 30, "สัดส่วนเก็บก่อนกลาง");
  expect(SHEET.ratio, "E3", 50, "% ตัดผ่าน");
  expect(SHEET.beforeMid, "D3", "งานครั้งที่ 1", "หัวข้อแรก (demo ถูกแทน)");
  expect(SHEET.beforeMid, "D4", 10, "คะแนนเต็มหัวข้อแรก");
  expect(SHEET.beforeMid, "X4", 30, "เต็มรวมเก็บก่อนกลาง");
  expect(SHEET.beforeMid, "B5", "4650", "รหัสคนที่ 1");
  expect(SHEET.beforeMid, "X5", 24, "รวมคนที่ 1");
  expect(SHEET.beforeMid, "D6", 8.5, "ทศนิยมคนที่ 2");
  expect(SHEET.beforeMid, "E7", null, "ช่องว่างคนที่ 3 ไม่ถูกเติม");
  expect(SHEET.beforeMid, "X7", 13, "รวมคนที่ 3 ข้ามช่องว่าง");
  expect(SHEET.beforeMid, "A8", null, "แถวที่ 4 ว่าง (demo A123 หาย)");
  expect(SHEET.mid, "B5", "4650", "B กลางภาค (เคยเป็นสูตรลิงก์)");
  expect(SHEET.final, "D7", null, "ปลายภาคคนที่ 3 ยังไม่สอบ");
  expect(SHEET.behavior, "L4", 3, "ช่องสำรอง 9 มีคนกรอก → เต็ม 3 ถูกเติม");
  expect(SHEET.behavior, "M4", null, "ช่องสำรอง 10 ไม่มีใครกรอก → เต็มว่าง");
  expect(SHEET.behavior, "X5", 3, "ฐานนิยมคนที่ 1");
  expect(SHEET.readWrite, "I6", null, "อ่านคิดคนที่ 2 (1,2,3) ไม่มีฐานนิยม → ว่าง");
  expect(SHEET.competency, "N5", 3, "ฐานนิยมสมรรถนะคนที่ 1");
  // dev1
  expect(SHEET.dev1, "A2", 50, "fRatioQuiz");
  expect(SHEET.dev1, "G2", 10, "maxGrade1");
  expect(SHEET.dev1, "AA2", "งานครั้งที่ 1", "nameGrade1");
  expect(SHEET.dev1, "ES2", 50, "maxgradetotal");
  expect(SHEET.dev1, "CQ2", 3, "maxBehavior9 (ช่องสำรองที่ใช้)");
  // dev2
  expect(SHEET.dev2, "A2", "4650", "stdSID คนที่ 1");
  expect(SHEET.dev2, "B3", 8.5, "scoreGrade1 คนที่ 2 ทศนิยม");
  expect(SHEET.dev2, "BJ4", null, "scoreFinal1 คนที่ 3 ว่าง");
  expect(SHEET.dev2, "BT2", 15, "scoreMidTermSUM คนที่ 1");
  expect(SHEET.dev2, "BV3", 2, "scoreBahaviorSUM คนที่ 2 (ฐานนิยมรวมช่องสำรอง)");
  expect(SHEET.dev2, "A5", null, "แถวที่ 4 ไม่มีนักเรียน");

  // ไม่เหลือสูตรใน dev sheets
  for (const name of [SHEET.dev1, SHEET.dev2]) {
    let remaining = 0;
    rb.getWorksheet(name)!.eachRow((row) =>
      row.eachCell((cell) => {
        const v = cell.value;
        if (v && typeof v === "object" && ("formula" in v || "sharedFormula" in v)) remaining++;
      }),
    );
    console.log(`  ${remaining === 0 ? "ok  " : "FAIL"} "${name}" ไม่เหลือสูตรค้าง`);
    if (remaining > 0) failures++;
  }

  // ---------- เคส partial export: เอาเฉพาะอ่านคิดวิเคราะห์ (ไม่มีสัดส่วน ไม่มีหัวข้อคะแนน) ----------
  const partial: ExportData = {
    ratios: null,
    beforeMidItems: [],
    midItems: [],
    afterMidItems: [],
    finalItems: [],
    students: data.students.map((s) => ({
      ...s,
      beforeMid: [],
      mid: [],
      afterMid: [],
      final: [],
      behavior: Array(20).fill(null),
      competency: Array(10).fill(null),
      // readWrite คงไว้
    })),
  };
  const wb2 = await buildWorkbook(partial);
  const OUT2 = OUT.replace(".xlsx", "-partial.xlsx");
  await wb2.xlsx.writeFile(OUT2);
  const rb2 = new ExcelJS.Workbook();
  await rb2.xlsx.readFile(OUT2);
  const expect2 = (sheet: string, addr: string, expected: ExcelJS.CellValue, label: string) => {
    const actual = rb2.getWorksheet(sheet)!.getCell(addr).value ?? null;
    const ok = actual === expected;
    console.log(`  ${ok ? "ok  " : "FAIL"} [partial] ${label}: ${sheet}!${addr} = ${JSON.stringify(actual)}${ok ? "" : ` (คาด ${JSON.stringify(expected)})`}`);
    if (!ok) failures++;
  };
  console.log("\nเคส export เฉพาะอ่านคิดวิเคราะห์:");
  expect2(SHEET.ratio, "A3", null, "สัดส่วนว่างตาม template");
  expect2(SHEET.beforeMid, "D3", 1, "demo 'ตัวอย่าง' ถูกแทนด้วยเลข 1 เมื่อไม่มีหัวข้อ");
  expect2(SHEET.beforeMid, "D4", null, "demo คะแนนเต็ม 10 ถูกเคลียร์");
  expect2(SHEET.beforeMid, "B5", "4650", "รหัสนักเรียนยังอยู่ (key สำหรับจับคู่)");
  expect2(SHEET.beforeMid, "D5", null, "คะแนนเก็บว่าง");
  expect2(SHEET.readWrite, "D5", 3, "คะแนนอ่านคิดยังอยู่");
  expect2(SHEET.dev1, "A2", null, "fRatioQuiz ว่าง");
  expect2(SHEET.dev1, "G2", null, "maxGrade1 ว่าง");
  expect2(SHEET.dev1, "EV2", 3, "maxReadWrite1 ยังอยู่");
  expect2(SHEET.dev2, "A2", "4650", "stdSID ยังอยู่");
  expect2(SHEET.dev2, "B2", null, "scoreGrade1 ว่าง");
  expect2(SHEET.dev2, "BY2", 3, "scoreReadWrite1 ยังอยู่");
  expect2(SHEET.dev2, "BW2", 3, "getReadWrite (ฐานนิยม) ยังอยู่");

  console.log(failures === 0 ? "\nผ่านทุกข้อ ✔" : `\nไม่ผ่าน ${failures} ข้อ ✘`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
