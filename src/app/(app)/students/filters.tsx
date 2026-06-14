"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function StudentFilters({
  levelRooms,
}: {
  /** ชั้น → รายการห้องที่มีจริงในชั้นนั้น */
  levelRooms: Record<string, number[]>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const level = params.get("level") ?? "";
  const room = params.get("room") ?? "";
  const [q, setQ] = useState(params.get("q") ?? "");

  const levels = Object.keys(levelRooms);
  const roomsForLevel = level ? levelRooms[level] ?? [] : [];

  function apply(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === "") sp.delete(key);
      else sp.set(key, value);
    }
    router.push(`/students?${sp.toString()}`);
  }

  // ค้นหาแบบ debounce — พิมพ์เสร็จ 400ms ค่อยยิง
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => apply({ q: q || undefined }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilter = level || room || q;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={level} onValueChange={(v) => apply({ level: v, room: undefined })}>
        <SelectTrigger className="w-32">
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

      <Select
        value={room}
        onValueChange={(v) => apply({ room: v })}
        disabled={!level}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder={level ? "เลือกห้อง" : "เลือกชั้นก่อน"} />
        </SelectTrigger>
        <SelectContent>
          {roomsForLevel.map((r) => (
            <SelectItem key={r} value={String(r)}>
              ห้อง {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นหาชื่อหรือรหัสนักเรียน…"
        className="w-64"
      />

      {hasFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            router.push("/students");
          }}
        >
          ล้างตัวกรอง
        </Button>
      )}
    </div>
  );
}
