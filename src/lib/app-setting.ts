import "server-only";
import { prisma } from "@/lib/prisma";
import { getAcademicYearById } from "@/lib/school-app";

export interface WorkingPeriod {
  workingYearId: number;
  workingYearBE: number;
  workingSemester: number;
}

/**
 * ปี+เทอมที่ระบบกำลังทำงาน (singleton id=1)
 * ยังไม่เคยตั้ง → null — ทุกหน้าจะพาไป /setup ให้เลือกก่อน (ไม่ตั้งค่าให้อัตโนมัติ)
 */
export async function getWorkingPeriod(): Promise<WorkingPeriod | null> {
  const setting = await prisma.appSetting.findUnique({ where: { id: 1 } });
  if (!setting) return null;
  return {
    workingYearId: setting.workingYearId,
    workingYearBE: setting.workingYearBE,
    workingSemester: setting.workingSemester,
  };
}

/** เปลี่ยนปี/เทอมทำงาน — ไม่ลบข้อมูลเดิม (คะแนนของปี/เทอมอื่นยังอยู่ครบ) */
export async function setWorkingPeriod(yearId: number, semester: number): Promise<WorkingPeriod> {
  if (semester !== 1 && semester !== 2) throw new Error("ภาคเรียนต้องเป็น 1 หรือ 2");
  const year = await getAcademicYearById(yearId);
  if (!year) throw new Error(`ไม่พบปีการศึกษา id=${yearId} ใน school_app`);
  const saved = await prisma.appSetting.upsert({
    where: { id: 1 },
    create: { id: 1, workingYearId: year.id, workingYearBE: year.year_be, workingSemester: semester },
    update: { workingYearId: year.id, workingYearBE: year.year_be, workingSemester: semester },
  });
  return {
    workingYearId: saved.workingYearId,
    workingYearBE: saved.workingYearBE,
    workingSemester: saved.workingSemester,
  };
}
