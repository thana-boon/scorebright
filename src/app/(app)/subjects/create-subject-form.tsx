"use client";

import { useActionState, useMemo, useState } from "react";
import { createSubjectAction, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface RoomOption {
  level: string;
  room: number;
  studentCount: number;
}

export function CreateSubjectForm({ roomOptions }: { roomOptions: RoomOption[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createSubjectAction,
    {},
  );
  const [level, setLevel] = useState<string>("");
  const levels = useMemo(() => [...new Set(roomOptions.map((r) => r.level))], [roomOptions]);
  const rooms = useMemo(
    () => roomOptions.filter((r) => r.level === level),
    [roomOptions, level],
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>+ สร้างวิชาใหม่</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>สร้างวิชาใหม่</DialogTitle>
          <DialogDescription>
            วิชาผูกกับปี/เทอมที่ทำงานอยู่ — หัวข้อและสัดส่วนใช้ร่วมกันทุกห้องที่เลือก
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
              <Label htmlFor="subjectCode">รหัสวิชา</Label>
              <Input id="subjectCode" name="subjectCode" placeholder="เช่น ว22101" required maxLength={20} />
            </div>
            <div className="space-y-2">
              <Label>ระดับชั้น</Label>
              <Select value={level} onValueChange={setLevel} name="classLevel" required>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกชั้น" />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subjectName">ชื่อวิชา</Label>
            <Input id="subjectName" name="subjectName" placeholder="เช่น วิทยาศาสตร์ 3" required maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label>ห้องที่สอน</Label>
            {level === "" ? (
              <p className="text-sm text-muted-foreground">เลือกระดับชั้นก่อน</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {rooms.map((r) => (
                  <label
                    key={r.room}
                    className="flex items-center gap-2 rounded-md border p-2 text-sm has-[[data-state=checked]]:border-primary"
                  >
                    <Checkbox name="rooms" value={String(r.room)} />
                    ห้อง {r.room}
                    <span className="ms-auto text-xs text-muted-foreground">{r.studentCount} คน</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={pending || level === ""}>
            {pending ? "กำลังสร้าง…" : "สร้างวิชา"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
