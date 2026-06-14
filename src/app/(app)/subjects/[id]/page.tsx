import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getWorkingPeriod } from "@/lib/app-setting";
import { listLevelRooms } from "@/lib/school-app";
import { prisma } from "@/lib/prisma";
import { CATEGORY_LABELS, CATEGORY_LIMITS, CATEGORY_ORDER } from "@/lib/score-categories";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConfigForm } from "./config-form";
import { ItemsSection } from "./items-section";
import { SubjectHeaderActions } from "./subject-header-actions";

export const dynamic = "force-dynamic";

export default async function SubjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
      scoreItems: {
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
        include: { _count: { select: { scores: true } } },
      },
    },
  });
  if (!subject || (subject.teacherId !== session.uid && session.role !== "admin")) notFound();

  const otherPeriod =
    subject.academicYearBE !== period.workingYearBE || subject.semester !== period.workingSemester;

  const levelRooms = (await listLevelRooms(period.workingYearId)).filter(
    (lr) => lr.class_level === subject.classLevel,
  );
  const roomOptions = levelRooms.map((lr) => ({ room: lr.class_room, studentCount: lr.student_count }));

  const itemsByCategory = CATEGORY_ORDER.map((category) => ({
    category,
    items: subject.scoreItems
      .filter((i) => i.category === category)
      .map((i) => ({
        id: i.id,
        name: i.name,
        maxScore: i.maxScore.toString(),
        scoreCount: i._count.scores,
      })),
  }));

  const hasAnyScore = subject.scoreItems.some((i) => i._count.scores > 0);

  // เช็คความพร้อมก่อนกรอกคะแนน/export
  const config = subject.scoreConfig;
  const ratioOf = {
    BEFORE_MID: config?.ratioBeforeMid ?? 0,
    MID: config?.ratioMid ?? 0,
    AFTER_MID: config?.ratioAfterMid ?? 0,
    FINAL: config?.ratioFinal ?? 0,
  };
  const missingItems = CATEGORY_ORDER.filter(
    (c) => ratioOf[c] > 0 && !subject.scoreItems.some((i) => i.category === c),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">
            <Link href="/subjects" className="hover:underline">
              วิชาของฉัน
            </Link>{" "}
            / {subject.subjectCode}
          </div>
          <h1 className="text-xl font-semibold">
            {subject.subjectCode} — {subject.subjectName}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{subject.classLevel}</Badge>
            <Badge variant="secondary">ห้อง {subject.rooms.map((r) => r.classRoom).join(", ")}</Badge>
            <Badge variant="outline">
              ปี {subject.academicYearBE} เทอม {subject.semester}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link href={`/subjects/${subject.id}/scores`}>กรอกคะแนน</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/subjects/${subject.id}/summary`}>สรุป/เกรด</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/subjects/${subject.id}/export`}>Export</Link>
          </Button>
          <SubjectHeaderActions
            subjectId={subject.id}
            subjectCode={subject.subjectCode}
            subjectName={subject.subjectName}
            classLevel={subject.classLevel}
            selectedRooms={subject.rooms.map((r) => r.classRoom)}
            roomOptions={roomOptions}
            hasData={hasAnyScore || subject.scoreItems.length > 0}
          />
        </div>
      </div>

      {otherPeriod && (
        <Alert variant="destructive">
          <AlertTitle>วิชานี้อยู่คนละปี/เทอมกับที่ระบบทำงานอยู่</AlertTitle>
          <AlertDescription>
            วิชานี้เป็นของปี {subject.academicYearBE} เทอม {subject.semester} แต่ระบบตั้งอยู่ที่ปี{" "}
            {period.workingYearBE} เทอม {period.workingSemester} — เปลี่ยนได้ที่หน้าปีการศึกษา
          </AlertDescription>
        </Alert>
      )}

      {missingItems.length > 0 && (
        <Alert>
          <AlertTitle>ยังตั้งค่าไม่ครบ</AlertTitle>
          <AlertDescription>
            ช่วงที่มีสัดส่วน &gt; 0 แต่ยังไม่มีหัวข้อคะแนน:{" "}
            {missingItems.map((c) => CATEGORY_LABELS[c]).join(", ")} — ต้องมีอย่างน้อย 1 หัวข้อจึงจะ export ได้
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">สัดส่วนคะแนน</CardTitle>
          <CardDescription>
            4 ช่วงต้องรวมเป็น 100 — ตรงกับชีท &quot;ตั้งค่าสัดส่วนคะแนน&quot; ของไฟล์ SchoolBright
            ถ้าโรงเรียนไม่แยกเก็บก่อน/หลังกลางภาค ให้ใส่ช่วงที่ไม่ใช้เป็น 0
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConfigForm
            subjectId={subject.id}
            initial={
              config
                ? {
                    ratioBeforeMid: config.ratioBeforeMid,
                    ratioMid: config.ratioMid,
                    ratioAfterMid: config.ratioAfterMid,
                    ratioFinal: config.ratioFinal,
                    passPercent: config.passPercent,
                  }
                : null
            }
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {itemsByCategory.map(({ category, items }) => {
          const maxTotal = items.reduce((acc, i) => acc + Number(i.maxScore), 0);
          return (
            <Card key={category}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{CATEGORY_LABELS[category]}</CardTitle>
                  <Badge variant="outline">
                    {items.length}/{CATEGORY_LIMITS[category]} หัวข้อ
                    {items.length > 0 ? ` · เต็มรวม ${maxTotal}` : ""}
                  </Badge>
                </div>
                {ratioOf[category] === 0 && config && (
                  <CardDescription>ช่วงนี้สัดส่วนเป็น 0 — ไม่ต้องมีหัวข้อก็ได้</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <ItemsSection
                  subjectId={subject.id}
                  category={category}
                  items={items}
                  limit={CATEGORY_LIMITS[category]}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">คุณลักษณะฯ / อ่านคิดวิเคราะห์ / สมรรถนะ</CardTitle>
          <CardDescription>
            หัวข้อของ 3 ส่วนนี้ template SchoolBright กำหนดตายตัว (8 / 3 / 5 ข้อ คะแนน 0-3)
            ไม่ต้องตั้งค่า — กรอกในหน้ากรอกคะแนนได้เลย
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
