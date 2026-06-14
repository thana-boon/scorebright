import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getWorkingPeriod } from "@/lib/app-setting";
import { listStudentsByYear, studentFullName } from "@/lib/school-app";
import { prisma } from "@/lib/prisma";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/score-categories";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreWorkbench } from "./workbench";

export const dynamic = "force-dynamic";

export default async function ScoresPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const subjectId = Number(id);
  if (!Number.isInteger(subjectId)) notFound();

  const session = (await getSession())!;
  const period = await getWorkingPeriod();
  if (!period) redirect("/setup");

  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      rooms: { orderBy: { classRoom: "asc" } },
      scoreConfig: true,
      scoreItems: { orderBy: [{ category: "asc" }, { sortOrder: "asc" }] },
    },
  });
  if (!subject || (subject.teacherId !== session.uid && session.role !== "admin")) notFound();

  if (subject.academicYearBE !== period.workingYearBE || subject.semester !== period.workingSemester) {
    return (
      <Alert variant="destructive">
        <AlertTitle>วิชานี้อยู่คนละปี/เทอมกับที่ระบบทำงานอยู่</AlertTitle>
        <AlertDescription>
          กรอกคะแนนได้เฉพาะวิชาของปี {period.workingYearBE} เทอม {period.workingSemester} —
          เปลี่ยนปี/เทอมได้ที่<Link href="/setup" className="underline">หน้าปีการศึกษา</Link>
        </AlertDescription>
      </Alert>
    );
  }

  const roomSet = new Set(subject.rooms.map((r) => r.classRoom));
  const students = (await listStudentsByYear(period.workingYearId))
    .filter((s) => s.class_level === subject.classLevel && roomSet.has(s.class_room))
    .map((s) => ({
      id: s.id,
      code: s.student_code,
      name: studentFullName(s),
      room: s.class_room,
      no: s.number_in_room,
    }));

  const studentIds = students.map((s) => s.id);
  const itemIds = subject.scoreItems.map((i) => i.id);

  const [scores, traits] = await Promise.all([
    itemIds.length > 0 && studentIds.length > 0
      ? prisma.score.findMany({
          where: { scoreItemId: { in: itemIds }, studentId: { in: studentIds } },
        })
      : Promise.resolve([]),
    studentIds.length > 0
      ? prisma.traitScore.findMany({
          where: { subjectId: subject.id, studentId: { in: studentIds } },
        })
      : Promise.resolve([]),
  ]);

  const scoreTabs = CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    items: subject.scoreItems
      .filter((i) => i.category === category)
      .map((i) => ({ id: i.id, name: i.name, max: Number(i.maxScore) })),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">
            <Link href="/subjects" className="hover:underline">
              วิชาของฉัน
            </Link>{" "}
            /{" "}
            <Link href={`/subjects/${subject.id}`} className="hover:underline">
              {subject.subjectCode}
            </Link>{" "}
            / กรอกคะแนน
          </div>
          <h1 className="text-xl font-semibold">
            กรอกคะแนน — {subject.subjectCode} {subject.subjectName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{subject.classLevel}</Badge>
          <Badge variant="secondary">{students.length} คน</Badge>
          <Button asChild size="sm" variant="outline">
            <Link href={`/subjects/${subject.id}/summary`}>สรุป/เกรด</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/subjects/${subject.id}/export`}>Export</Link>
          </Button>
        </div>
      </div>

      {subject.scoreItems.length === 0 ? (
        <Alert>
          <AlertTitle>ยังไม่มีหัวข้อคะแนน</AlertTitle>
          <AlertDescription>
            ไป<Link href={`/subjects/${subject.id}`} className="underline">หน้าตั้งค่าวิชา</Link>
            เพื่อเพิ่มหัวข้อคะแนนก่อน — ส่วนคุณลักษณะฯ/อ่านคิดฯ/สมรรถนะ กรอกได้เลยไม่ต้องตั้งหัวข้อ
          </AlertDescription>
        </Alert>
      ) : null}

      <ScoreWorkbench
        subjectId={subject.id}
        scoreTabs={scoreTabs}
        students={students}
        rooms={subject.rooms.map((r) => r.classRoom)}
        initialScores={scores.map((s) => ({
          itemId: s.scoreItemId,
          studentId: s.studentId,
          value: s.value === null ? null : Number(s.value),
        }))}
        initialTraits={traits.map((t) => ({
          kind: t.kind,
          studentId: t.studentId,
          value: t.value,
        }))}
      />
    </div>
  );
}
