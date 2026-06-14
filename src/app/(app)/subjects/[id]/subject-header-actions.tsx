"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { updateSubjectAction, deleteSubjectAction, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function SubjectHeaderActions({
  subjectId,
  subjectCode,
  subjectName,
  classLevel,
  selectedRooms,
  roomOptions,
  hasData,
}: {
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  classLevel: string;
  selectedRooms: number[];
  roomOptions: { room: number; studentCount: number }[];
  hasData: boolean;
}) {
  const updateBound = updateSubjectAction.bind(null, subjectId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateBound, {});
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  useEffect(() => {
    if (state.saved) setOpen(false);
  }, [state]);

  return (
    <div className="flex gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            แก้ไขวิชา
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขวิชา</DialogTitle>
            <DialogDescription>
              ระดับชั้น ({classLevel}) เปลี่ยนไม่ได้ — ถ้าสร้างผิดชั้นให้ลบแล้วสร้างใหม่
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            {state.error && (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-code">รหัสวิชา</Label>
                <Input id="edit-code" name="subjectCode" defaultValue={subjectCode} required maxLength={20} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">ชื่อวิชา</Label>
                <Input id="edit-name" name="subjectName" defaultValue={subjectName} required maxLength={200} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>ห้องที่สอน</Label>
              <div className="grid grid-cols-2 gap-2">
                {roomOptions.map((r) => (
                  <label
                    key={r.room}
                    className="flex items-center gap-2 rounded-md border p-2 text-sm has-[[data-state=checked]]:border-primary"
                  >
                    <Checkbox
                      name="rooms"
                      value={String(r.room)}
                      defaultChecked={selectedRooms.includes(r.room)}
                    />
                    ห้อง {r.room}
                    <span className="ms-auto text-xs text-muted-foreground">{r.studentCount} คน</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                เอาห้องออกไม่ลบคะแนนที่กรอกไว้ — ติ๊กกลับมาคะแนนเดิมจะกลับมาเอง
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        trigger={
          <Button variant="outline" size="sm" className="text-destructive" disabled={isPending}>
            ลบวิชา
          </Button>
        }
        title={`ลบวิชา ${subjectCode}?`}
        description={
          hasData
            ? "สัดส่วน หัวข้อ และคะแนนทั้งหมดของวิชานี้จะถูกลบถาวร กู้คืนไม่ได้"
            : "วิชานี้ยังไม่มีข้อมูลคะแนน ลบได้โดยไม่กระทบอะไร"
        }
        confirmLabel="ลบวิชา"
        destructive
        onConfirm={() => startTransition(() => deleteSubjectAction(subjectId).then(() => {}))}
      />
    </div>
  );
}
