"use client";

import { useActionState } from "react";
import { saveWorkingPeriodAction, type SetupState } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface YearOption {
  id: number;
  yearBE: number;
  title: string | null;
  isActive: boolean;
}

export function SetupForm({
  years,
  currentYearId,
  currentSemester,
  canEdit,
}: {
  years: YearOption[];
  currentYearId: number | null;
  currentSemester: number | null;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState<SetupState, FormData>(
    saveWorkingPeriodAction,
    {},
  );

  // ครั้งแรกที่ยังไม่เคยตั้งค่า: เสนอปีที่ is_active=1 ของ school_app ไว้ให้ (ผู้ใช้ยังต้องกดบันทึกเอง)
  const selectedYearId = currentYearId ?? years.find((y) => y.isActive)?.id ?? null;
  const selectedSemester = currentSemester ?? 1;

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.saved && (
        <Alert>
          <AlertDescription>บันทึกแล้ว — ทุกหน้าจะแสดงข้อมูลของปี/เทอมที่เลือกนี้</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>ปีการศึกษา</Label>
          <Select
            name="yearId"
            defaultValue={selectedYearId !== null ? String(selectedYearId) : undefined}
            disabled={!canEdit || pending}
            required
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกปีการศึกษา" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y.id} value={String(y.id)}>
                  ปีการศึกษา {y.yearBE}
                  {y.isActive ? " — ปีปัจจุบันของโรงเรียน" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            ตัวเลือกมาจากระบบหลักเท่านั้น — เพิ่ม/ลบปีการศึกษาที่นี่ไม่ได้
          </p>
        </div>

        <div className="space-y-2">
          <Label>ภาคเรียน</Label>
          <Select
            name="semester"
            defaultValue={String(selectedSemester)}
            disabled={!canEdit || pending}
            required
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="เลือกภาคเรียน" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">ภาคเรียนที่ 1</SelectItem>
              <SelectItem value="2">ภาคเรียนที่ 2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {canEdit ? (
        <Button type="submit" disabled={pending}>
          {pending ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          เฉพาะผู้ดูแลระบบเท่านั้นที่เปลี่ยนค่านี้ได้ — บัญชีของท่านดูได้อย่างเดียว
        </p>
      )}
    </form>
  );
}
