"use client";

import { useRouter } from "next/navigation";
import { UserCog } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface TeacherOption {
  id: number;
  label: string;
  subjectCount: number;
}

/** ตัวเลือกสำหรับ admin: ดูวิชาของครูคนไหน (ค่าว่าง = ตัวเอง) */
export function TeacherPicker({
  teachers,
  selfId,
  value,
}: {
  teachers: TeacherOption[];
  selfId: number;
  value: number;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <UserCog className="size-4 text-muted-foreground" />
      <Select
        value={String(value)}
        onValueChange={(v) =>
          router.push(Number(v) === selfId ? "/subjects" : `/subjects?teacher=${v}`)
        }
      >
        <SelectTrigger className="w-60">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {teachers.map((t) => (
            <SelectItem key={t.id} value={String(t.id)}>
              {t.id === selfId ? "วิชาของฉัน" : t.label} ({t.subjectCount})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
