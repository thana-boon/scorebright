import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarRange,
  Users,
  BookOpen,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { getWorkingPeriod } from "@/lib/app-setting";
import { listStudentsByYear } from "@/lib/school-app";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { runDataChecks } from "./students/data-checks";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = (await getSession())!;
  const period = await getWorkingPeriod();
  if (!period) redirect("/setup");

  const students = await listStudentsByYear(period.workingYearId);
  const checks = runDataChecks(students);
  const issueCount =
    checks.duplicateCodes.length + checks.duplicateNumbers.length + checks.overLimitRooms.length;

  const levels = new Set(students.map((s) => s.class_level));
  const rooms = new Set(students.map((s) => `${s.class_level}/${s.class_room}`));

  const subjects = await prisma.subject.findMany({
    where: {
      teacherId: session.uid,
      academicYearBE: period.workingYearBE,
      semester: period.workingSemester,
    },
    include: { scoreConfig: true, _count: { select: { scoreItems: true } } },
    orderBy: [{ classLevel: "asc" }, { subjectCode: "asc" }],
  });
  const readySubjects = subjects.filter((s) => s.scoreConfig && s._count.scoreItems > 0).length;

  const stats = [
    {
      icon: CalendarRange,
      tint: "text-blue-600 bg-blue-50",
      label: "ปีการศึกษาที่ทำงาน",
      value: `${period.workingYearBE} · เทอม ${period.workingSemester}`,
      action: { href: "/setup", text: "เปลี่ยนปี/เทอม" },
    },
    {
      icon: Users,
      tint: "text-emerald-600 bg-emerald-50",
      label: "นักเรียนในปีนี้",
      value: `${students.length.toLocaleString()} คน`,
      sub: `${levels.size} ระดับชั้น · ${rooms.size} ห้อง`,
      action: { href: "/students", text: "ดูรายชื่อ" },
    },
    {
      icon: issueCount > 0 ? ShieldAlert : ShieldCheck,
      tint: issueCount > 0 ? "text-red-600 bg-red-50" : "text-emerald-600 bg-emerald-50",
      label: "คุณภาพข้อมูลนักเรียน",
      value: issueCount > 0 ? `${issueCount} จุดต้องตรวจ` : "ปกติ",
      sub: issueCount > 0 ? "รหัส/เลขที่ซ้ำ หรือห้องเกิน 60 คน" : "ไม่พบความผิดปกติ",
      action: issueCount > 0 ? { href: "/students", text: "ตรวจสอบ" } : undefined,
    },
    {
      icon: BookOpen,
      tint: "text-violet-600 bg-violet-50",
      label: "วิชาของฉัน (เทอมนี้)",
      value: `${subjects.length} วิชา`,
      sub: subjects.length > 0 ? `พร้อมกรอกคะแนน ${readySubjects} วิชา` : undefined,
      action: { href: "/subjects", text: "จัดการวิชา" },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">สวัสดี {session.displayName} 👋</h1>
        <p className="text-sm text-muted-foreground">
          ภาพรวมปีการศึกษา {period.workingYearBE} ภาคเรียนที่ {period.workingSemester}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className={`mb-1 flex size-9 items-center justify-center rounded-lg ${s.tint}`}>
                <s.icon className="size-5" />
              </div>
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-xl">{s.value}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {s.sub && <p className="text-sm text-muted-foreground">{s.sub}</p>}
              {s.action && (
                <Button asChild variant="outline" size="sm">
                  <Link href={s.action.href}>
                    {s.action.text} <ArrowRight className="ms-1 size-3.5" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {subjects.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">เข้ากรอกคะแนนเร็ว ๆ</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {subjects.map((s) => (
              <Button key={s.id} asChild variant="outline" size="sm">
                <Link href={`/subjects/${s.id}/scores`}>
                  {s.subjectCode} {s.classLevel}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ขั้นตอนการใช้งาน</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["เลือกปี/เทอม", "ที่หน้าปีการศึกษา (ทำแล้ว)"],
              ["สร้างวิชา", "รหัสวิชา ระดับชั้น ห้องที่สอน"],
              ["ตั้งสัดส่วน + หัวข้อ", "4 ช่วงรวม 100 คะแนน"],
              ["กรอกคะแนน", "พิมพ์เองหรือวางจาก Excel"],
              ["Export", "ไฟล์พร้อม import เข้า SchoolBright"],
            ].map(([title, desc], i) => (
              <li key={title} className="flex gap-3 rounded-lg border bg-background p-3">
                <Badge
                  variant={i === 0 ? "default" : "secondary"}
                  className="h-6 w-6 shrink-0 justify-center rounded-full p-0"
                >
                  {i + 1}
                </Badge>
                <div>
                  <div className="font-medium">{title}</div>
                  <div className="text-muted-foreground">{desc}</div>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
