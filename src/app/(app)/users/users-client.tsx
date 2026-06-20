"use client";

import { useActionState, useEffect, useState } from "react";
import { UserPlus, KeyRound, Pencil, Trash2, RefreshCw } from "lucide-react";
import {
  createUserAction,
  updateUserAction,
  resetPasswordAction,
  deleteUserAction,
  syncTeachersAction,
  type UserActionState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface UserRow {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "staff";
  source: "local" | "teacher_api";
  isActive: boolean;
  subjectCount: number;
  createdAt: string;
}

function FormAlert({ state }: { state: UserActionState }) {
  if (!state.error) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>{state.error}</AlertDescription>
    </Alert>
  );
}

export function CreateUserDialog() {
  const [state, formAction, pending] = useActionState<UserActionState, FormData>(
    createUserAction,
    {},
  );
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (state.saved) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="me-1 size-4" /> เพิ่มผู้ใช้
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>เพิ่มผู้ใช้ใหม่</DialogTitle>
          <DialogDescription>บัญชีนี้เป็นของระบบ ScoreBright เอง ไม่เกี่ยวกับระบบอื่น</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <FormAlert state={state} />
          <div className="space-y-1.5">
            <Label htmlFor="nu-username">ชื่อผู้ใช้ (สำหรับ login)</Label>
            <Input id="nu-username" name="username" placeholder="เช่น kru.somsri" required minLength={3} maxLength={50} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nu-display">ชื่อที่แสดง</Label>
            <Input id="nu-display" name="displayName" placeholder="เช่น ครูสมศรี ใจดี" required maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nu-password">รหัสผ่าน</Label>
            <Input id="nu-password" name="password" type="text" required minLength={6} placeholder="อย่างน้อย 6 ตัวอักษร" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="role" value="admin" /> ให้สิทธิ์ผู้ดูแลระบบ (จัดการผู้ใช้/เปลี่ยนปีการศึกษาได้)
          </label>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "กำลังสร้าง…" : "สร้างบัญชี"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SyncTeachersButton() {
  const [state, formAction, pending] = useActionState<UserActionState, FormData>(
    syncTeachersAction,
    {},
  );
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RefreshCw className="me-1 size-4" /> ซิงค์ครูจากระบบกลาง
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ซิงค์รายชื่อครูจากระบบกลาง</DialogTitle>
          <DialogDescription>
            ดึงรายชื่อครูจาก teacher-api เข้ามาเป็นบัญชีในระบบ — ครูใหม่จะได้สิทธิ์ “ครู”
            สิทธิ์ที่เคยตั้งไว้จะไม่ถูกเปลี่ยน และครูที่ถูกลบจากระบบกลางจะถูกปิดใช้งาน (ข้อมูลยังอยู่)
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          {state.summary && (
            <Alert>
              <AlertDescription>{state.summary}</AlertDescription>
            </Alert>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              ปิด
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "กำลังซิงค์…" : "เริ่มซิงค์"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, selfId }: { user: UserRow; selfId: number }) {
  const action = updateUserAction.bind(null, user.id);
  const [state, formAction, pending] = useActionState<UserActionState, FormData>(action, {});
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (state.saved) setOpen(false);
  }, [state]);
  const isSelf = user.id === selfId;
  const isSynced = user.source === "teacher_api";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="แก้ไข">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>แก้ไข {user.username}</DialogTitle>
          {isSelf && <DialogDescription>บัญชีของตัวเอง — ลดสิทธิ์/ปิดใช้งานไม่ได้</DialogDescription>}
          {isSynced && !isSelf && (
            <DialogDescription>บัญชีครูที่ซิงค์มา — ชื่อมาจากระบบกลาง ตั้งได้แค่สิทธิ์</DialogDescription>
          )}
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <FormAlert state={state} />
          <div className="space-y-1.5">
            <Label htmlFor={`eu-display-${user.id}`}>ชื่อที่แสดง</Label>
            <Input
              id={`eu-display-${user.id}`}
              name="displayName"
              defaultValue={user.displayName}
              required
              maxLength={100}
              readOnly={isSynced}
              className={isSynced ? "bg-muted text-muted-foreground" : undefined}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="role" value="admin" defaultChecked={user.role === "admin"} disabled={isSelf} />
            สิทธิ์ผู้ดูแลระบบ
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="isActive" defaultChecked={user.isActive} disabled={isSelf} />
            เปิดใช้งานบัญชี (ปิด = login ไม่ได้ แต่ข้อมูลวิชา/คะแนนยังอยู่)
          </label>
          {/* checkbox ที่ disabled จะไม่ถูกส่งค่า — ส่งค่าจริงของตัวเองแทน */}
          {isSelf && (
            <>
              <input type="hidden" name="role" value="admin" />
              <input type="hidden" name="isActive" value="on" />
            </>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user }: { user: UserRow }) {
  const action = resetPasswordAction.bind(null, user.id);
  const [state, formAction, pending] = useActionState<UserActionState, FormData>(action, {});
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (state.saved) setOpen(false);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="รีเซ็ตรหัสผ่าน">
          <KeyRound className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>รีเซ็ตรหัสผ่าน — {user.username}</DialogTitle>
          <DialogDescription>ตั้งรหัสใหม่แล้วแจ้งให้เจ้าของบัญชีเปลี่ยนภายหลัง</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <FormAlert state={state} />
          <Input name="password" type="text" required minLength={6} placeholder="รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)" />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "กำลังบันทึก…" : "ตั้งรหัสใหม่"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({
  user,
  candidates,
}: {
  user: UserRow;
  /** ครูที่ใช้งานได้คนอื่น ๆ ที่จะรับช่วงดูแลวิชาแทนได้ */
  candidates: UserRow[];
}) {
  const action = deleteUserAction.bind(null, user.id);
  const [state, formAction, pending] = useActionState<UserActionState, FormData>(action, {});
  const [open, setOpen] = useState(false);
  const [reassignTo, setReassignTo] = useState("");
  useEffect(() => {
    if (state.saved) setOpen(false);
  }, [state]);
  // เปิดใหม่ทุกครั้งให้เริ่มจากยังไม่เลือกผู้รับช่วง
  useEffect(() => {
    if (open) setReassignTo("");
  }, [open]);

  const hasSubjects = user.subjectCount > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="ลบ" className="text-destructive hover:text-destructive">
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ลบผู้ใช้ — {user.username}</DialogTitle>
          <DialogDescription>
            {hasSubjects
              ? `ผู้ใช้นี้สร้างวิชาไว้ ${user.subjectCount} วิชา และมีการทำคะแนนแล้ว ต้องการลบใช่หรือไม่?`
              : "การลบบัญชีนี้ทำถาวร ย้อนกลับไม่ได้"}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <FormAlert state={state} />
          {hasSubjects && (
            <>
              <input type="hidden" name="reassignTo" value={reassignTo} />
              <div className="space-y-1.5">
                <Label>ให้ครูคนอื่นดูแลวิชาแทนหรือไม่</Label>
                <Select value={reassignTo} onValueChange={setReassignTo}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="— ไม่โอน (จะลบวิชาและคะแนนทั้งหมด) —" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.displayName} ({c.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {reassignTo
                    ? "วิชาและคะแนนทั้งหมดจะถูกโอนไปให้ครูที่เลือก"
                    : "ถ้าไม่เลือก เมื่อกดลบ ระบบจะลบวิชาและคะแนนของครูคนนี้ทั้งหมด"}
                </p>
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              ยกเลิก
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending
                ? "กำลังลบ…"
                : hasSubjects && reassignTo
                  ? "โอนวิชาแล้วลบผู้ใช้"
                  : hasSubjects
                    ? "ลบผู้ใช้และคะแนนทั้งหมด"
                    : "ลบผู้ใช้"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UsersTable({ users, selfId }: { users: UserRow[]; selfId: number }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ชื่อผู้ใช้</TableHead>
          <TableHead>ชื่อที่แสดง</TableHead>
          <TableHead>สิทธิ์</TableHead>
          <TableHead>สถานะ</TableHead>
          <TableHead className="text-right">วิชา</TableHead>
          <TableHead className="w-32"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((u) => (
          <TableRow key={u.id} className={!u.isActive ? "opacity-50" : undefined}>
            <TableCell className="font-medium">
              {u.username}
              {u.id === selfId && <span className="ms-1 text-xs text-muted-foreground">(คุณ)</span>}
              {u.source === "teacher_api" && (
                <span className="ms-1 text-xs text-muted-foreground">(ระบบกลาง)</span>
              )}
            </TableCell>
            <TableCell>{u.displayName}</TableCell>
            <TableCell>
              <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                {u.role === "admin" ? "ผู้ดูแลระบบ" : "ครู"}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={u.isActive ? "secondary" : "destructive"}>
                {u.isActive ? "ใช้งานได้" : "ปิดใช้งาน"}
              </Badge>
            </TableCell>
            <TableCell className="text-right">{u.subjectCount}</TableCell>
            <TableCell>
              <div className="flex justify-end">
                <EditUserDialog user={u} selfId={selfId} />
                {u.source === "local" && <ResetPasswordDialog user={u} />}
                {u.id !== selfId && (
                  <DeleteUserDialog
                    user={u}
                    candidates={users.filter((c) => c.id !== u.id && c.isActive)}
                  />
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
