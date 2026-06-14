import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getWorkingPeriod } from "@/lib/app-setting";
import { listLevelRooms } from "@/lib/school-app";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CreateSubjectForm } from "./create-subject-form";
import { TeacherPicker, type TeacherOption } from "./teacher-picker";

export const dynamic = "force-dynamic";

export default async function SubjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ teacher?: string }>;
}) {
  const session = (await getSession())!;
  const period = await getWorkingPeriod();
  if (!period) redirect("/setup");

  const { teacher } = await searchParams;
  const isAdmin = session.role === "admin";

  // admin ดูวิชาของครูคนอื่นได้ผ่าน ?teacher=<id> — ครูทั่วไปดูได้เฉพาะของตัวเอง
  let viewTeacherId = session.uid;
  let viewTeacher: { displayName: string } | null = null;
  if (isAdmin && teacher) {
    const t = Number(teacher);
    if (Number.isInteger(t) && t !== session.uid) {
      const found = await prisma.user.findUnique({ where: { id: t }, select: { displayName: true } });
      if (found) {
        viewTeacherId = t;
        viewTeacher = found;
      }
    }
  }
  const viewingOther = viewTeacherId !== session.uid;

  const [subjects, levelRooms, teacherOptions] = await Promise.all([
    prisma.subject.findMany({
      where: {
        teacherId: viewTeacherId,
        academicYearBE: period.workingYearBE,
        semester: period.workingSemester,
      },
      include: {
        rooms: { orderBy: { classRoom: "asc" } },
        scoreConfig: true,
        _count: { select: { scoreItems: true } },
      },
      orderBy: [{ classLevel: "asc" }, { subjectCode: "asc" }],
    }),
    listLevelRooms(period.workingYearId),
    isAdmin ? buildTeacherOptions(period.workingYearBE, period.workingSemester, session.uid) : Promise.resolve([]),
  ]);

  const roomOptions = levelRooms.map((lr) => ({
    level: lr.class_level,
    room: lr.class_room,
    studentCount: lr.student_count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {viewingOther ? `วิชาของ ${viewTeacher?.displayName}` : "วิชาของฉัน"}
          </h1>
          <p className="text-sm text-muted-foreground">
            ปีการศึกษา {period.workingYearBE} · ภาคเรียนที่ {period.workingSemester} — {subjects.length} วิชา
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <TeacherPicker teachers={teacherOptions} selfId={session.uid} value={viewTeacherId} />
          )}
          {!viewingOther && <CreateSubjectForm roomOptions={roomOptions} />}
        </div>
      </div>

      {viewingOther && (
        <Alert className="border-primary/30 bg-primary/5">
          <AlertTitle>กำลังดูวิชาของครูท่านอื่น (สิทธิ์ผู้ดูแลระบบ)</AlertTitle>
          <AlertDescription>
            คุณเปิดดู แก้ไข กรอกคะแนน และ export วิชาของ {viewTeacher?.displayName} ได้ —
            กลับมาที่วิชาของตัวเองได้จากตัวเลือกด้านบน
          </AlertDescription>
        </Alert>
      )}

      {subjects.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {viewingOther ? "ครูท่านนี้ยังไม่มีวิชาในเทอมนี้" : "ยังไม่มีวิชาในเทอมนี้"}
            </CardTitle>
            <CardDescription>
              {viewingOther
                ? "เลือกครูคนอื่น หรือกลับมาที่วิชาของตัวเองจากตัวเลือกด้านบน"
                : 'กด "สร้างวิชาใหม่" เพื่อเริ่ม — กำหนดรหัสวิชา ระดับชั้น และห้องที่สอน จากนั้นตั้งสัดส่วนคะแนนและหัวข้อ แล้วจึงกรอกคะแนนได้'}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => {
            const ready = s.scoreConfig !== null && s._count.scoreItems > 0;
            return (
              <Link key={s.id} href={`/subjects/${s.id}`} className="group">
                <Card className="h-full transition-colors group-hover:border-primary/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">
                        {s.subjectCode} — {s.subjectName}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={
                          ready
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-amber-300 bg-amber-50 text-amber-700"
                        }
                      >
                        {ready ? "พร้อมกรอกคะแนน" : "ยังตั้งค่าไม่ครบ"}
                      </Badge>
                    </div>
                    <CardDescription>
                      {s.classLevel} · ห้อง {s.rooms.map((r) => r.classRoom).join(", ")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {s.scoreConfig
                      ? `สัดส่วน ${s.scoreConfig.ratioBeforeMid}/${s.scoreConfig.ratioMid}/${s.scoreConfig.ratioAfterMid}/${s.scoreConfig.ratioFinal}`
                      : "ยังไม่ตั้งสัดส่วน"}
                    {" · "}
                    {s._count.scoreItems} หัวข้อ
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** รายชื่อครูที่มีวิชาในเทอมนี้ + ตัวเอง (เรียงตัวเองมาก่อน) */
async function buildTeacherOptions(
  yearBE: number,
  semester: number,
  selfId: number,
): Promise<TeacherOption[]> {
  const grouped = await prisma.subject.groupBy({
    by: ["teacherId"],
    where: { academicYearBE: yearBE, semester },
    _count: { _all: true },
  });
  const countById = new Map(grouped.map((g) => [g.teacherId, g._count._all]));
  const ids = new Set<number>([selfId, ...countById.keys()]);
  const users = await prisma.user.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, displayName: true, username: true },
  });
  return users
    .map((u) => ({
      id: u.id,
      label: `${u.displayName} (${u.username})`,
      subjectCount: countById.get(u.id) ?? 0,
    }))
    .sort((a, b) => (a.id === selfId ? -1 : b.id === selfId ? 1 : a.label.localeCompare(b.label, "th")));
}
