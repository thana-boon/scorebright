import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { getSession } from "@/lib/auth";
import { getWorkingPeriod } from "@/lib/app-setting";
import { buildWorkbook, ROOM_LIMIT } from "@/lib/export/build-workbook";
import {
  assembleRoomData,
  exportFileName,
  exportZipName,
  getExportSubject,
} from "@/lib/export/assemble";
import { validateForExport } from "@/lib/export/validate";
import { parseSections } from "@/lib/export/sections";

export const dynamic = "force-dynamic";

function attachment(filename: string): string {
  // ชื่อไฟล์ภาษาไทยต้องส่งแบบ RFC 5987
  return `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const subjectId = Number(id);
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const period = await getWorkingPeriod();
  if (!period) return NextResponse.json({ error: "ยังไม่ได้เลือกปีการศึกษา" }, { status: 400 });

  const subject = await getExportSubject(subjectId);
  if (!subject || (subject.teacherId !== session.uid && session.role !== "admin")) {
    return NextResponse.json({ error: "ไม่พบวิชาหรือไม่มีสิทธิ์" }, { status: 404 });
  }
  if (subject.academicYearBE !== period.workingYearBE || subject.semester !== period.workingSemester) {
    return NextResponse.json(
      { error: "วิชานี้อยู่คนละปี/เทอมกับที่ระบบตั้งไว้" },
      { status: 400 },
    );
  }

  // block เฉพาะระดับห้อง (เกิน 60 คน/ไม่มีนักเรียน) — เรื่องอื่นเป็นคำเตือนบนหน้า export
  const report = await validateForExport(subject, period.workingYearId);
  const roomParam = req.nextUrl.searchParams.get("room");
  const sections = parseSections(req.nextUrl.searchParams.get("sections"));

  try {
    if (roomParam) {
      // ไฟล์เดียว: ห้องที่ระบุ
      const room = Number(roomParam);
      if (!subject.rooms.some((r) => r.classRoom === room)) {
        return NextResponse.json({ error: `วิชานี้ไม่ได้สอนห้อง ${room}` }, { status: 400 });
      }
      const roomReport = report.rooms.find((r) => r.room === room);
      if (roomReport && roomReport.blockers.length > 0) {
        return NextResponse.json({ error: roomReport.blockers.join(" / ") }, { status: 400 });
      }
      const data = await assembleRoomData(subject, period.workingYearId, room, sections);
      const wb = await buildWorkbook(data);
      const buffer = new Uint8Array(await wb.xlsx.writeBuffer());
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": attachment(exportFileName(subject, room)),
        },
      });
    }

    // zip ทุกห้องที่ผ่านเงื่อนไข (ห้องที่ติด blocker จะถูกข้าม — หน้า UI แจ้งไว้แล้ว)
    const zip = new JSZip();
    let added = 0;
    for (const r of subject.rooms) {
      const roomReport = report.rooms.find((rep) => rep.room === r.classRoom);
      if (roomReport && roomReport.blockers.length > 0) continue;
      const data = await assembleRoomData(subject, period.workingYearId, r.classRoom, sections);
      if (data.students.length === 0 || data.students.length > ROOM_LIMIT) continue;
      const wb = await buildWorkbook(data);
      zip.file(exportFileName(subject, r.classRoom), await wb.xlsx.writeBuffer());
      added++;
    }
    if (added === 0) {
      return NextResponse.json({ error: "ไม่มีห้องที่ export ได้" }, { status: 400 });
    }
    const zipBuffer = new Uint8Array(await zip.generateAsync({ type: "nodebuffer" }));
    return new NextResponse(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": attachment(exportZipName(subject)),
      },
    });
  } catch (err) {
    console.error("export:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "สร้างไฟล์ไม่สำเร็จ" },
      { status: 500 },
    );
  }
}
