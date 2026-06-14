"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { setWorkingPeriod } from "@/lib/app-setting";

export interface SetupState {
  error?: string;
  saved?: boolean;
}

export async function saveWorkingPeriodAction(
  _prev: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const session = await requireSession();
  if (session.role !== "admin") {
    return { error: "เฉพาะผู้ดูแลระบบเท่านั้นที่เปลี่ยนปีการศึกษา/ภาคเรียนได้" };
  }

  const yearId = Number(formData.get("yearId"));
  const semester = Number(formData.get("semester"));
  if (!Number.isInteger(yearId) || yearId <= 0) return { error: "กรุณาเลือกปีการศึกษา" };
  if (semester !== 1 && semester !== 2) return { error: "กรุณาเลือกภาคเรียน" };

  try {
    await setWorkingPeriod(yearId, semester);
  } catch (err) {
    console.error("setup: บันทึกไม่สำเร็จ", err);
    return { error: err instanceof Error ? err.message : "บันทึกไม่สำเร็จ" };
  }
  revalidatePath("/", "layout");
  return { saved: true };
}
