/**
 * สำรวจโครงสร้างไฟล์ template ของ SchoolBright:
 * - รายชื่อ sheet ทั้งหมด + สถานะ (visible/hidden) + ขนาด
 * - เซลล์ทุกเซลล์ที่มีค่า/สูตร ใน sheet สำหรับdev1, สำหรับdev2 (contract จริงที่ SchoolBright อ่าน)
 * - แถวหัวตาราง + ตัวอย่างข้อมูล + สูตรทั้งหมดใน sheet ที่มองเห็น
 *
 * เขียนผลลัพธ์เป็น UTF-8 ลง inspect-output.txt (กัน encoding ไทยพังจาก console redirect)
 * ใช้: npm run inspect-template
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
const OUT_PATH = path.resolve(__dirname, "..", "inspect-output.txt");

const out: string[] = [];
function log(line: string) {
  out.push(line);
}

function cellDump(cell: ExcelJS.Cell): string | null {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === "object") {
    if ("formula" in v && v.formula) {
      return `={${v.formula}} -> ${JSON.stringify((v as ExcelJS.CellFormulaValue).result ?? null)}`;
    }
    if ("sharedFormula" in v && (v as ExcelJS.CellSharedFormulaValue).sharedFormula) {
      const sf = v as ExcelJS.CellSharedFormulaValue;
      return `=shared{${sf.sharedFormula}} -> ${JSON.stringify(sf.result ?? null)}`;
    }
    if ("richText" in v) {
      return JSON.stringify((v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join(""));
    }
    return JSON.stringify(v);
  }
  return JSON.stringify(v);
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE_PATH);

  log(`Template: ${TEMPLATE_PATH}`);
  log("");
  log("=== Sheets ===");
  for (const ws of wb.worksheets) {
    const merges = Object.keys((ws as any)._merges ?? {});
    log(
      `- [${ws.id}] "${ws.name}" state=${ws.state} rows=${ws.rowCount} cols=${ws.columnCount} merges=[${merges.join(", ")}]`,
    );
  }

  for (const ws of wb.worksheets) {
    const isDev = ws.name.includes("dev") || ws.name === "Update log";
    log("");
    log(`=== Sheet "${ws.name}" (state=${ws.state}) ===`);

    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      if (!row.hasValues) continue;
      const cells: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => {
        // ข้ามเซลล์ลูกใน merge range (ค่าซ้ำกับ master)
        if (cell.isMerged && cell.master.address !== cell.address) return;
        const d = cellDump(cell);
        if (d === null) return;
        const isFormula =
          typeof cell.value === "object" &&
          cell.value !== null &&
          ("formula" in cell.value || "sharedFormula" in cell.value);
        // dev sheets: ทุกเซลล์ / sheet ปกติ: 8 แถวแรก + สูตรทุกตัว
        if (isDev || r <= 8 || isFormula) {
          cells.push(`${cell.address}: ${d}`);
        }
      });
      if (cells.length) log(`  r${r} | ${cells.join(" | ")}`);
    }
  }

  fs.writeFileSync(OUT_PATH, out.join("\n"), "utf8");
  console.log(`written ${out.length} lines -> ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
