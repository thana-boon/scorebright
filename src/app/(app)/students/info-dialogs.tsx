"use client";

import { ShieldAlert, ShieldCheck, DoorOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface IssueData {
  duplicateCodes: { code: string; detail: string }[];
  duplicateNumbers: { key: string; detail: string }[];
  overLimitRooms: { key: string; detail: string }[];
}

export function DataIssuesDialog({ issues, yearBE }: { issues: IssueData; yearBE: number }) {
  const count =
    issues.duplicateCodes.length + issues.duplicateNumbers.length + issues.overLimitRooms.length;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={count > 0 ? "destructive" : "outline"} size="sm">
          {count > 0 ? (
            <>
              <ShieldAlert className="me-1 size-4" /> ปัญหาข้อมูล ({count})
            </>
          ) : (
            <>
              <ShieldCheck className="me-1 size-4" /> ข้อมูลปกติ
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>คุณภาพข้อมูลนักเรียน ปี {yearBE}</DialogTitle>
          <DialogDescription>
            เช็คเฉพาะภายในปีการศึกษาเดียวกัน — ปัญหาเหล่านี้แก้ได้ที่ระบบต้นทาง (school_app) เท่านั้น
          </DialogDescription>
        </DialogHeader>
        {count === 0 ? (
          <p className="text-sm text-muted-foreground">
            ไม่พบรหัสซ้ำ เลขที่ซ้ำ หรือห้องเกิน 60 คน ✓
          </p>
        ) : (
          <div className="space-y-4 text-sm">
            {issues.duplicateCodes.length > 0 && (
              <section>
                <h3 className="mb-1 font-medium text-destructive">
                  รหัสนักเรียนซ้ำ ({issues.duplicateCodes.length})
                </h3>
                <ul className="list-disc space-y-1 ps-5">
                  {issues.duplicateCodes.map((d) => (
                    <li key={d.code}>{d.detail}</li>
                  ))}
                </ul>
              </section>
            )}
            {issues.duplicateNumbers.length > 0 && (
              <section>
                <h3 className="mb-1 font-medium text-destructive">
                  เลขที่ซ้ำในห้องเดียวกัน ({issues.duplicateNumbers.length})
                </h3>
                <ul className="list-disc space-y-1 ps-5">
                  {issues.duplicateNumbers.map((d) => (
                    <li key={d.key}>{d.detail}</li>
                  ))}
                </ul>
              </section>
            )}
            {issues.overLimitRooms.length > 0 && (
              <section>
                <h3 className="mb-1 font-medium text-destructive">
                  ห้องเกิน 60 คน — export ไม่ได้ ({issues.overLimitRooms.length})
                </h3>
                <ul className="list-disc space-y-1 ps-5">
                  {issues.overLimitRooms.map((d) => (
                    <li key={d.key}>{d.detail}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function RoomSummaryDialog({
  rooms,
}: {
  rooms: { key: string; count: number; over: boolean }[];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <DoorOpen className="me-1 size-4" /> จำนวนต่อห้อง
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>จำนวนนักเรียนต่อห้อง</DialogTitle>
          <DialogDescription>ห้องสีแดง = เกิน 60 คน/ไฟล์ของ SchoolBright</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {rooms.map((r) => (
            <Badge key={r.key} variant={r.over ? "destructive" : "secondary"}>
              {r.key} — {r.count} คน
            </Badge>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
