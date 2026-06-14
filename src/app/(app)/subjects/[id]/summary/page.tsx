import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getWorkingPeriod } from "@/lib/app-setting";
import { listStudentsByYearRoom, studentFullName } from "@/lib/school-app";
import { prisma } from "@/lib/prisma";
import { CATEGORY_ORDER } from "@/lib/score-categories";
import { BEHAVIOR_COLUMNS, READ_COLUMNS, COMPETENCY_COLUMNS } from "@/lib/trait-columns";
import { modeMaxOrBlank } from "@/lib/export/build-workbook";
import { categoryScore, computeGrade } from "@/lib/grade";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SummaryView, type StudentSummary } from "./summary-view";

export const dynamic = "force-dynamic";

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
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
          เปลี่ยนปี/เทอมได้ที่<Link href="/setup" className="underline">หน้าปีการศึกษา</Link>
        </AlertDescription>
      </Alert>
    );
  }

  const config = subject.scoreConfig;
  if (!config) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">สรุปคะแนนและเกรด — {subject.subjectCode}</h1>
        <Alert>
          <AlertTitle>ยังตั้งสัดส่วนคะแนนไม่ครบ</AlertTitle>
          <AlertDescription>
            ต้องตั้งสัดส่วนคะแนนก่อนถึงจะคิดเกรดได้ —{" "}
            <Link href={`/subjects/${subject.id}`} className="underline">
              ไปหน้าตั้งค่าวิชา
            </Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const ratioOf = {
    BEFORE_MID: config.ratioBeforeMid,
    MID: config.ratioMid,
    AFTER_MID: config.ratioAfterMid,
    FINAL: config.ratioFinal,
  };
  const itemsOf = Object.fromEntries(
    CATEGORY_ORDER.map((c) => [c, subject.scoreItems.filter((i) => i.category === c)]),
  );

  // โหลดนักเรียนทุกห้อง + คะแนนทั้งหมด
  const roomStudents = await Promise.all(
    subject.rooms.map((r) => listStudentsByYearRoom(period.workingYearId, subject.classLevel, r.classRoom)),
  );
  const allStudents = roomStudents.flat();
  const studentIds = allStudents.map((s) => s.id);

  const scores =
    subject.scoreItems.length > 0 && studentIds.length > 0
      ? await prisma.score.findMany({
          where: {
            scoreItemId: { in: subject.scoreItems.map((i) => i.id) },
            studentId: { in: studentIds },
          },
        })
      : [];
  const scoreMap = new Map<string, number | null>();
  for (const s of scores) scoreMap.set(`${s.scoreItemId}:${s.studentId}`, s.value === null ? null : Number(s.value));

  const traits =
    studentIds.length > 0
      ? await prisma.traitScore.findMany({
          where: { subjectId: subject.id, studentId: { in: studentIds } },
        })
      : [];
  const traitMap = new Map<string, number | null>();
  for (const t of traits) traitMap.set(`${t.kind}:${t.studentId}`, t.value);

  const modeOf = (kinds: { kind: string }[], studentId: number): number | null =>
    modeMaxOrBlank(kinds.map((c) => traitMap.get(`${c.kind}:${studentId}`) ?? null));

  const summaries: StudentSummary[] = allStudents.map((stu) => {
    let anyMissing = false;
    const cats = CATEGORY_ORDER.map((cat) => {
      const items = itemsOf[cat];
      const values = items.map((i) => {
        const key = `${i.id}:${stu.id}`;
        const has = scoreMap.has(key) && scoreMap.get(key) !== null;
        if (!has) anyMissing = true;
        return has ? (scoreMap.get(key) as number) : null;
      });
      return categoryScore(ratioOf[cat], values, items.map((i) => Number(i.maxScore)));
    });
    const g = computeGrade(cats, anyMissing);
    return {
      id: stu.id,
      no: stu.number_in_room,
      code: stu.student_code,
      name: studentFullName(stu),
      room: stu.class_room,
      beforeMid: round(cats[0].weighted),
      mid: round(cats[1].weighted),
      afterMid: round(cats[2].weighted),
      final: round(cats[3].weighted),
      total: g.total,
      grade: g.grade.grade,
      gradeValue: g.grade.value,
      incomplete: g.incomplete,
      behaviorScore: modeOf(BEHAVIOR_COLUMNS, stu.id),
      readScore: modeOf(READ_COLUMNS, stu.id),
      competencyScore: modeOf(COMPETENCY_COLUMNS, stu.id),
    };
  });

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
            / สรุปคะแนน
          </div>
          <h1 className="text-xl font-semibold">
            สรุปคะแนนและเกรด — {subject.subjectCode} {subject.subjectName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            สัดส่วน {config.ratioBeforeMid}/{config.ratioMid}/{config.ratioAfterMid}/{config.ratioFinal}
          </Badge>
          <Button asChild size="sm" variant="outline">
            <Link href={`/subjects/${subject.id}/scores`}>กรอกคะแนน</Link>
          </Button>
        </div>
      </div>

      <SummaryView
        students={summaries}
        rooms={subject.rooms.map((r) => r.classRoom)}
        ratios={ratioOf}
      />
    </div>
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
