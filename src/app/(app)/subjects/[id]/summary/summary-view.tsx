"use client";

import { useMemo, useState } from "react";
import { GRADE_BANDS } from "@/lib/grade";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface StudentSummary {
  id: number;
  no: number;
  code: string;
  name: string;
  room: number;
  beforeMid: number;
  mid: number;
  afterMid: number;
  final: number;
  total: number;
  grade: string;
  gradeValue: number;
  incomplete: boolean;
  behaviorScore: number | null; // ฐานนิยม 0-3 (null = ยังไม่มีค่าซ้ำ/ยังไม่กรอก)
  readScore: number | null;
  competencyScore: number | null;
}

function gradeColor(grade: string): string {
  const v = Number(grade);
  if (v >= 3) return "bg-emerald-100 text-emerald-800";
  if (v >= 2) return "bg-amber-100 text-amber-800";
  if (v >= 1) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
}

export function SummaryView({
  students,
  rooms,
  ratios,
}: {
  students: StudentSummary[];
  rooms: number[];
  ratios: { BEFORE_MID: number; MID: number; AFTER_MID: number; FINAL: number };
}) {
  const [roomFilter, setRoomFilter] = useState<string>(rooms.length === 1 ? String(rooms[0]) : "all");

  const visible = useMemo(() => {
    const list =
      roomFilter === "all" ? students : students.filter((s) => s.room === Number(roomFilter));
    return [...list].sort((a, b) => a.room - b.room || a.no - b.no);
  }, [students, roomFilter]);

  const stats = useMemo(() => {
    if (visible.length === 0) return null;
    const totals = visible.map((s) => s.total);
    const avg = totals.reduce((a, b) => a + b, 0) / visible.length;
    const gpa = visible.reduce((a, s) => a + s.gradeValue, 0) / visible.length;
    const dist = new Map<string, number>();
    for (const b of GRADE_BANDS) dist.set(b.grade, 0);
    for (const s of visible) dist.set(s.grade, (dist.get(s.grade) ?? 0) + 1);
    const passed = visible.filter((s) => s.gradeValue >= 1).length;
    const incomplete = visible.filter((s) => s.incomplete).length;
    return { avg, gpa, dist, passed, failed: visible.length - passed, incomplete, n: visible.length };
  }, [visible]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={roomFilter} onValueChange={setRoomFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rooms.length > 1 && <SelectItem value="all">ทุกห้อง</SelectItem>}
            {rooms.map((r) => (
              <SelectItem key={r} value={String(r)}>
                ห้อง {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="นักเรียน" value={`${stats.n} คน`} sub={stats.incomplete > 0 ? `กรอกไม่ครบ ${stats.incomplete} คน` : "คะแนนครบทุกคน"} />
          <StatCard label="คะแนนเฉลี่ย" value={stats.avg.toFixed(2)} sub="จาก 100" />
          <StatCard label="GPA ห้อง" value={stats.gpa.toFixed(2)} sub="เฉลี่ยเกรด" />
          <StatCard
            label="ผ่าน / ไม่ผ่าน"
            value={`${stats.passed} / ${stats.failed}`}
            sub={`ตก (เกรด 0) ${stats.failed} คน`}
            danger={stats.failed > 0}
          />
        </div>
      )}

      {stats && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">การกระจายเกรด</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {GRADE_BANDS.map((b) => {
              const count = stats.dist.get(b.grade) ?? 0;
              return (
                <Badge
                  key={b.grade}
                  variant="outline"
                  className={cn("text-sm", count > 0 ? gradeColor(b.grade) : "opacity-50")}
                >
                  เกรด {b.grade}: {count} คน
                </Badge>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">คะแนนรายคน</CardTitle>
          <CardDescription>
            แต่ละช่วงแสดงคะแนนถ่วงน้ำหนักแล้ว (เก็บก่อนกลาง {ratios.BEFORE_MID} · กลางภาค {ratios.MID} ·
            เก็บหลังกลาง {ratios.AFTER_MID} · ปลายภาค {ratios.FINAL}) — รวมเต็ม 100
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[65vh] overflow-auto rounded-lg border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr className="border-b">
                  <th className="px-2 py-2 text-left font-medium">เลขที่</th>
                  <th className="px-2 py-2 text-left font-medium">รหัส</th>
                  <th className="px-2 py-2 text-left font-medium">ชื่อ-นามสกุล</th>
                  <th className="px-2 py-2 text-right font-medium">เก็บก่อนกลาง</th>
                  <th className="px-2 py-2 text-right font-medium">กลางภาค</th>
                  <th className="px-2 py-2 text-right font-medium">เก็บหลังกลาง</th>
                  <th className="px-2 py-2 text-right font-medium">ปลายภาค</th>
                  <th className="px-2 py-2 text-right font-medium">รวม</th>
                  <th className="px-2 py-2 text-center font-medium">เกรด</th>
                  <th className="border-s px-2 py-2 text-center font-medium" title="คุณลักษณะอันพึงประสงค์">คุณลักษณะ</th>
                  <th className="px-2 py-2 text-center font-medium" title="อ่าน คิดวิเคราะห์ เขียน">อ่านคิด</th>
                  <th className="px-2 py-2 text-center font-medium">สมรรถนะ</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-muted-foreground">
                      ไม่มีนักเรียน
                    </td>
                  </tr>
                ) : (
                  visible.map((s) => (
                    <tr key={s.id} className="border-b last:border-0 odd:bg-muted/20">
                      <td className="px-2 py-1.5">{s.no}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{s.code}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {s.name}
                        {s.incomplete && (
                          <span className="ms-1 text-xs text-amber-600" title="ยังกรอกคะแนนไม่ครบทุกช่อง">
                            ◔
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{s.beforeMid}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{s.mid}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{s.afterMid}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{s.final}</td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{s.total}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={cn("inline-block min-w-9 rounded px-2 py-0.5 text-sm font-medium", gradeColor(s.grade))}>
                          {s.grade}
                        </span>
                      </td>
                      <td className="border-s px-2 py-1.5 text-center tabular-nums text-muted-foreground">
                        {s.behaviorScore ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-center tabular-nums text-muted-foreground">
                        {s.readScore ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-center tabular-nums text-muted-foreground">
                        {s.competencyScore ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            ◔ = ยังกรอกคะแนนไม่ครบทุกช่อง (ช่องว่างคิดเป็น 0 ในการรวมคะแนน — เกรดอาจเปลี่ยนเมื่อกรอกครบ) ·
            คุณลักษณะ/อ่านคิด/สมรรถนะ แสดงผลแบบฐานนิยม 0-3 (&quot;—&quot; = ยังไม่มีค่าซ้ำ/ยังไม่กรอก)
            ไม่นำมารวมในเกรด ตามแนวทางของ SchoolBright
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  danger,
}: {
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardDescription>{label}</CardDescription>
        <CardTitle className={cn("text-2xl", danger && "text-destructive")}>{value}</CardTitle>
      </CardHeader>
      {sub && <CardContent className="pt-0 text-sm text-muted-foreground">{sub}</CardContent>}
    </Card>
  );
}
