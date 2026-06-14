"use client";

import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { EXPORT_SECTIONS, SECTION_LABELS, type ExportSection } from "@/lib/export/sections";
import { BASE_PATH } from "@/lib/base-path";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function ExportControls({
  subjectId,
  rooms,
}: {
  subjectId: number;
  rooms: { room: number; blocked: boolean; fileName: string }[];
}) {
  const [selected, setSelected] = useState<Set<ExportSection>>(new Set(EXPORT_SECTIONS));
  const allSelected = selected.size === EXPORT_SECTIONS.length;
  const exportableRooms = rooms.filter((r) => !r.blocked);

  function toggle(section: ExportSection) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  const qs =
    selected.size === 0 || allSelected ? "" : `sections=${[...selected].join(",")}`;
  // <a download> ต้องเติม basePath เอง (Next ไม่เติมให้ลิงก์ <a> ธรรมดา)
  const zipHref = `${BASE_PATH}/subjects/${subjectId}/export/download${qs ? `?${qs}` : ""}`;
  const roomHref = (room: number) =>
    `${BASE_PATH}/subjects/${subjectId}/export/download?room=${room}${qs ? `&${qs}` : ""}`;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium">ส่วนที่จะใส่ในไฟล์</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setSelected(allSelected ? new Set() : new Set(EXPORT_SECTIONS))
            }
          >
            {allSelected ? "ไม่เลือกเลย" : "เลือกทั้งหมด"}
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {EXPORT_SECTIONS.map((s) => (
            <label
              key={s}
              className="flex cursor-pointer items-center gap-2 rounded-md border bg-background p-2 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
            >
              <Checkbox checked={selected.has(s)} onCheckedChange={() => toggle(s)} />
              {SECTION_LABELS[s]}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          ส่วนที่ไม่เลือกจะถูกเว้นว่างในไฟล์ — SchoolBright จะไม่เปลี่ยนแปลงข้อมูลส่วนนั้น
          เหมาะกับการส่งคะแนนเป็นรอบ ๆ เช่น ส่งเฉพาะกลางภาค หรือเฉพาะอ่านคิดวิเคราะห์
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild disabled={selected.size === 0}>
          <a href={zipHref} download>
            <Download className="me-1 size-4" /> ดาวน์โหลดทุกห้อง (zip · {exportableRooms.length} ไฟล์)
          </a>
        </Button>
        {selected.size === 0 && (
          <span className="text-sm text-destructive">เลือกอย่างน้อย 1 ส่วน</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {rooms.map((r) =>
          r.blocked ? null : (
            <Button key={r.room} asChild variant="outline" size="sm" title={r.fileName}>
              <a href={roomHref(r.room)} download>
                <FileSpreadsheet className="me-1 size-4" /> ห้อง {r.room}
              </a>
            </Button>
          ),
        )}
      </div>
    </div>
  );
}
