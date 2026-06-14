import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getWorkingPeriod } from "@/lib/app-setting";
import { getExportSubject, exportFileName } from "@/lib/export/assemble";
import { validateForExport } from "@/lib/export/validate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ExportControls } from "./export-controls";

export const dynamic = "force-dynamic";

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const subjectId = Number(id);
  if (!Number.isInteger(subjectId)) notFound();

  const session = (await getSession())!;
  const period = await getWorkingPeriod();
  if (!period) redirect("/setup");

  const subject = await getExportSubject(subjectId);
  if (!subject || (subject.teacherId !== session.uid && session.role !== "admin")) notFound();

  const otherPeriod =
    subject.academicYearBE !== period.workingYearBE || subject.semester !== period.workingSemester;
  const report = otherPeriod ? null : await validateForExport(subject, period.workingYearId);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">
          <Link href="/subjects" className="hover:underline">
            วิชาของฉัน
          </Link>{" "}
          /{" "}
          <Link href={`/subjects/${subject.id}`} className="hover:underline">
            {subject.subjectCode}
          </Link>{" "}
          / Export
        </div>
        <h1 className="text-xl font-semibold">
          Export เข้า SchoolBright — {subject.subjectCode} {subject.subjectName}
        </h1>
        <p className="text-sm text-muted-foreground">
          1 ไฟล์ = 1 วิชา × 1 ห้อง ตามกติกาของ SchoolBright
        </p>
      </div>

      {otherPeriod ? (
        <Alert variant="destructive">
          <AlertTitle>วิชานี้อยู่คนละปี/เทอมกับที่ระบบทำงานอยู่</AlertTitle>
          <AlertDescription>
            เปลี่ยนปี/เทอมได้ที่<Link href="/setup" className="underline">หน้าปีการศึกษา</Link>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {report && report.warnings.length > 0 && (
            <Alert className="border-amber-300 bg-amber-50 text-amber-900 [&>svg]:text-amber-900">
              <AlertTitle>ข้อควรรู้ก่อน export (ดาวน์โหลดได้ตามปกติ)</AlertTitle>
              <AlertDescription className="text-amber-900/90">
                <ul className="list-disc ps-5">
                  {report.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">ดาวน์โหลด</CardTitle>
            </CardHeader>
            <CardContent>
              <ExportControls
                subjectId={subject.id}
                rooms={
                  report?.rooms.map((r) => ({
                    room: r.room,
                    blocked: r.blockers.length > 0,
                    fileName: exportFileName(subject, r.room),
                  })) ?? []
                }
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {report?.rooms.map((r) => (
              <Card key={r.room} className={r.blockers.length > 0 ? "border-destructive/50" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      ห้อง {subject.classLevel}/{r.room}
                    </CardTitle>
                    <Badge variant="secondary">{r.studentCount} คน</Badge>
                  </div>
                  <CardDescription>{exportFileName(subject, r.room)}</CardDescription>
                </CardHeader>
                <CardContent>
                  {r.blockers.length > 0 ? (
                    <Alert variant="destructive">
                      <AlertTitle>ห้องนี้ export ไม่ได้</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc ps-5">
                          {r.blockers.map((b) => (
                            <li key={b}>{b}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  ) : r.missingByStudent.length > 0 ? (
                    <details className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                      <summary className="cursor-pointer font-medium text-amber-900">
                        ⚠ {r.missingByStudent.length} คนยังมีช่องคะแนนว่าง (ช่องว่างจะถูกเว้นไว้ในไฟล์)
                      </summary>
                      <ul className="mt-2 list-disc space-y-1 ps-5 text-amber-900">
                        {r.missingByStudent.slice(0, 15).map((m) => (
                          <li key={m.name}>
                            {m.name} — ขาด {m.missing.length} ช่อง ({m.missing.slice(0, 3).join(", ")}
                            {m.missing.length > 3 ? " …" : ""})
                          </li>
                        ))}
                        {r.missingByStudent.length > 15 && (
                          <li>… และอีก {r.missingByStudent.length - 15} คน</li>
                        )}
                      </ul>
                    </details>
                  ) : (
                    <p className="text-sm text-muted-foreground">คะแนนครบทุกคนทุกช่อง ✓</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">วิธีนำเข้า SchoolBright</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              แตกไฟล์ zip แล้วนำเข้าทีละไฟล์ (1 ไฟล์ต่อ 1 ห้อง) ในเมนูนำเข้าคะแนนของ SchoolBright —
              รหัสนักเรียนในไฟล์ต้องมีอยู่ในระบบ SchoolBright ไม่งั้นคะแนนทั้งไฟล์จะถูกปฏิเสธ (Bad Request)
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
