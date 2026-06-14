"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { ScoreCategory } from "@prisma/client";
import {
  addScoreItemAction,
  updateScoreItemAction,
  deleteScoreItemAction,
  moveScoreItemAction,
  type ActionState,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ItemView {
  id: number;
  name: string;
  maxScore: string; // Decimal ส่งข้าม boundary เป็น string
  scoreCount: number;
}

export function ItemsSection({
  subjectId,
  category,
  items,
  limit,
}: {
  subjectId: number;
  category: ScoreCategory;
  items: ItemView[];
  limit: number;
}) {
  const [editing, setEditing] = useState<ItemView | null>(null);
  const [isPending, startTransition] = useTransition();
  const full = items.length >= limit;

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>ชื่อหัวข้อ</TableHead>
              <TableHead className="w-24 text-right">คะแนนเต็ม</TableHead>
              <TableHead className="w-36"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, i) => (
              <TableRow key={item.id}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell className="text-right">{Number(item.maxScore)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={i === 0 || isPending}
                      title="เลื่อนขึ้น"
                      onClick={() =>
                        startTransition(() => moveScoreItemAction(subjectId, item.id, "up").then(() => {}))
                      }
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={i === items.length - 1 || isPending}
                      title="เลื่อนลง"
                      onClick={() =>
                        startTransition(() => moveScoreItemAction(subjectId, item.id, "down").then(() => {}))
                      }
                    >
                      ↓
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(item)}>
                      แก้ไข
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="sm" className="text-destructive" disabled={isPending}>
                          ลบ
                        </Button>
                      }
                      title={`ลบหัวข้อ "${item.name}"?`}
                      description={
                        item.scoreCount > 0
                          ? `หัวข้อนี้มีคะแนนที่กรอกแล้ว ${item.scoreCount} รายการ จะถูกลบถาวรทั้งหมด`
                          : "หัวข้อนี้ยังไม่มีคะแนน ลบได้โดยไม่กระทบข้อมูล"
                      }
                      confirmLabel="ลบหัวข้อ"
                      destructive
                      onConfirm={() =>
                        startTransition(() => deleteScoreItemAction(subjectId, item.id).then(() => {}))
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {full ? (
        <p className="text-sm text-muted-foreground">ครบ {limit} หัวข้อตาม limit ของ SchoolBright แล้ว</p>
      ) : (
        <AddItemForm subjectId={subjectId} category={category} />
      )}

      {editing && (
        <EditItemDialog
          subjectId={subjectId}
          item={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function AddItemForm({ subjectId, category }: { subjectId: number; category: ScoreCategory }) {
  const action = addScoreItemAction.bind(null, subjectId, category);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.saved) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Input name="name" placeholder="ชื่อหัวข้อ เช่น งานครั้งที่ 1" required className="flex-1" />
        <Input
          name="maxScore"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="เต็ม"
          required
          className="w-24"
        />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "…" : "เพิ่ม"}
        </Button>
      </div>
    </form>
  );
}

function EditItemDialog({
  subjectId,
  item,
  onClose,
}: {
  subjectId: number;
  item: ItemView;
  onClose: () => void;
}) {
  const action = updateScoreItemAction.bind(null, subjectId, item.id);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  useEffect(() => {
    if (state.saved) onClose();
  }, [state, onClose]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>แก้ไขหัวข้อ</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <Input name="name" defaultValue={item.name} required />
          <Input
            name="maxScore"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={Number(item.maxScore)}
            required
          />
          {item.scoreCount > 0 && (
            <p className="text-xs text-muted-foreground">
              หัวข้อนี้มีคะแนนแล้ว {item.scoreCount} รายการ — การลดคะแนนเต็มอาจทำให้คะแนนเดิมเกินเต็ม
              ระบบจะเตือนในหน้ากรอกคะแนน
            </p>
          )}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
