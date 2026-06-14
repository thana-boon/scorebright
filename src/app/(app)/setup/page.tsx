import { getSession } from "@/lib/auth";
import { getWorkingPeriod } from "@/lib/app-setting";
import { listAcademicYears } from "@/lib/school-app";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SetupForm, type YearOption } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const session = (await getSession())!;

  let years: YearOption[] = [];
  let period = null;
  let dbError: string | null = null;
  try {
    const [yearRows, current] = await Promise.all([listAcademicYears(), getWorkingPeriod()]);
    years = yearRows.map((y) => ({
      id: y.id,
      yearBE: y.year_be,
      title: y.title,
      isActive: y.is_active === 1,
    }));
    period = current;
  } catch (err) {
    console.error("setup: โหลดข้อมูลไม่ได้", err);
    dbError = "เชื่อมต่อฐานข้อมูลไม่ได้ — ตรวจ DATABASE_URL ใน .env และสิทธิ์ SELECT บน school_app";
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>ปีการศึกษาและภาคเรียนที่ทำงาน</CardTitle>
          <CardDescription>
            ทุกหน้า (รายชื่อนักเรียน วิชา คะแนน และการส่งออก) จะแสดงเฉพาะข้อมูลของปี/เทอมที่ตั้งไว้ที่นี่
            การเปลี่ยนปี/เทอมไม่ลบข้อมูลเดิม — คะแนนของปี/เทอมก่อนหน้ายังอยู่ครบ สลับกลับมาดูได้เสมอ
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dbError ? (
            <Alert variant="destructive">
              <AlertTitle>เชื่อมต่อฐานข้อมูลไม่ได้</AlertTitle>
              <AlertDescription>{dbError}</AlertDescription>
            </Alert>
          ) : years.length === 0 ? (
            <Alert>
              <AlertTitle>ไม่พบปีการศึกษา</AlertTitle>
              <AlertDescription>
                ตาราง school_app.academic_years ยังไม่มีข้อมูล — เพิ่มปีการศึกษาในระบบหลักก่อน
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {!period && (
                <Alert className="mb-4">
                  <AlertTitle>ยังไม่ได้เลือกปีการศึกษา</AlertTitle>
                  <AlertDescription>
                    เลือกปีการศึกษาและภาคเรียนก่อนเริ่มใช้งาน — ระบบเสนอปีที่เปิดใช้อยู่ใน school_app ไว้ให้แล้ว
                    ปี/เทอมสร้างหรือลบจากที่นี่ไม่ได้ ต้องจัดการในระบบหลักเท่านั้น
                  </AlertDescription>
                </Alert>
              )}
              <SetupForm
                years={years}
                currentYearId={period?.workingYearId ?? null}
                currentSemester={period?.workingSemester ?? null}
                canEdit={session.role === "admin"}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
