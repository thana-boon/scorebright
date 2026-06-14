import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { getWorkingPeriod } from "@/lib/app-setting";
import { listStudentsByYear, studentFullName, type Student } from "@/lib/school-app";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StudentFilters } from "./filters";
import { runDataChecks, ROOM_LIMIT } from "./data-checks";
import { DataIssuesDialog, RoomSummaryDialog } from "./info-dialogs";

export const dynamic = "force-dynamic";

const MAX_SEARCH_ROWS = 100;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; room?: string; q?: string }>;
}) {
  const { level, room, q } = await searchParams;

  let period;
  try {
    period = await getWorkingPeriod();
  } catch (err) {
    console.error("students: โหลด AppSetting ไม่ได้", err);
    return (
      <Alert variant="destructive">
        <AlertTitle>เชื่อมต่อฐานข้อมูลไม่ได้</AlertTitle>
        <AlertDescription>
          ตรวจ DATABASE_URL ใน .env ว่าชี้ไป MySQL ที่ถูกต้อง และรัน `npx prisma db push` แล้ว
        </AlertDescription>
      </Alert>
    );
  }
  if (!period) redirect("/setup");

  const all = await listStudentsByYear(period.workingYearId);
  const checks = runDataChecks(all);

  // ชั้น → ห้องที่มีจริงในชั้นนั้น (เรียงตามลำดับที่เจอ ซึ่ง query เรียง class_level/class_room ให้แล้ว)
  const levelRooms: Record<string, number[]> = {};
  for (const s of all) {
    (levelRooms[s.class_level] ??= []);
    if (!levelRooms[s.class_level].includes(s.class_room)) {
      levelRooms[s.class_level].push(s.class_room);
    }
  }

  // ตารางแสดงเมื่อ: เลือกชั้น+ห้องแล้ว หรือกำลังค้นหา
  const query = (q ?? "").trim().toLowerCase();
  const roomSelected = Boolean(level && room);
  const searching = query.length > 0;

  let shown: Student[] = [];
  let truncated = false;
  if (searching) {
    let pool = all;
    if (level) pool = pool.filter((s) => s.class_level === level);
    if (room) pool = pool.filter((s) => s.class_room === Number(room));
    const matched = pool.filter(
      (s) =>
        s.student_code.toLowerCase().includes(query) ||
        studentFullName(s).toLowerCase().includes(query),
    );
    truncated = matched.length > MAX_SEARCH_ROWS;
    shown = matched.slice(0, MAX_SEARCH_ROWS);
  } else if (roomSelected) {
    shown = all.filter((s) => s.class_level === level && s.class_room === Number(room));
  }

  // ข้อมูลสำหรับ modal
  const issueData = {
    duplicateCodes: checks.duplicateCodes.map((d) => ({
      code: d.code,
      detail: `รหัส ${d.code} ถูกใช้โดย ${d.students.length} คน: ${d.students
        .map((s) => `${studentFullName(s)} (${s.class_level}/${s.class_room} เลขที่ ${s.number_in_room})`)
        .join(", ")}`,
    })),
    duplicateNumbers: checks.duplicateNumbers.map((d) => ({
      key: `${d.level}-${d.room}-${d.number}`,
      detail: `ห้อง ${d.level}/${d.room} เลขที่ ${d.number} ซ้ำ ${d.students.length} คน: ${d.students
        .map((s) => `${studentFullName(s)} (รหัส ${s.student_code})`)
        .join(", ")}`,
    })),
    overLimitRooms: checks.overLimitRooms.map((d) => ({
      key: `${d.level}-${d.room}`,
      detail: `ห้อง ${d.level}/${d.room} มี ${d.count} คน`,
    })),
  };

  const roomSummary = new Map<string, number>();
  for (const s of all) {
    const key = `${s.class_level}/${s.class_room}`;
    roomSummary.set(key, (roomSummary.get(key) ?? 0) + 1);
  }
  const roomData = [...roomSummary.entries()].map(([key, count]) => ({
    key,
    count,
    over: count > ROOM_LIMIT,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">รายชื่อนักเรียน</h1>
          <p className="text-sm text-muted-foreground">
            ปีการศึกษา {period.workingYearBE} · ทั้งหมด {all.length.toLocaleString()} คน — อ่านจากระบบหลัก
            แก้ไขที่นี่ไม่ได้
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DataIssuesDialog issues={issueData} yearBE={period.workingYearBE} />
          <RoomSummaryDialog rooms={roomData} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StudentFilters levelRooms={levelRooms} />
      </div>

      {!roomSelected && !searching ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Search className="size-8 text-muted-foreground" />
            <CardTitle className="text-base">เลือกชั้นและห้อง หรือพิมพ์ค้นหา</CardTitle>
            <CardDescription>
              เลือกชั้นกับห้องจากตัวกรองด้านบนเพื่อแสดงรายชื่อ หรือพิมพ์ชื่อ/รหัสนักเรียนในช่องค้นหา
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {searching ? `ผลการค้นหา "${q}"` : `${level} ห้อง ${room}`} ({shown.length.toLocaleString()}
              {truncated ? "+" : ""} คน)
            </CardTitle>
            {truncated && (
              <CardDescription>
                แสดง {MAX_SEARCH_ROWS} รายการแรก — พิมพ์คำค้นให้เจาะจงขึ้น หรือเลือกชั้น/ห้องช่วยกรอง
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">เลขที่</TableHead>
                  <TableHead className="w-32">รหัสนักเรียน</TableHead>
                  <TableHead>ชื่อ-นามสกุล</TableHead>
                  <TableHead className="w-24">ชั้น</TableHead>
                  <TableHead className="w-20">ห้อง</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      ไม่พบนักเรียนตามเงื่อนไข{" "}
                      <Link href="/students" className="underline">
                        ล้างตัวกรอง
                      </Link>
                    </TableCell>
                  </TableRow>
                ) : (
                  shown.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.number_in_room}</TableCell>
                      <TableCell>{s.student_code}</TableCell>
                      <TableCell>{studentFullName(s)}</TableCell>
                      <TableCell>{s.class_level}</TableCell>
                      <TableCell>{s.class_room}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
