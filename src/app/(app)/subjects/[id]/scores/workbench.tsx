"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScoreCategory, TraitKind } from "@prisma/client";
import {
  saveScoresAction,
  saveTraitsAction,
  type ScoreEntry,
  type TraitEntry,
} from "./actions";
import {
  BEHAVIOR_COLUMNS,
  COMPETENCY_COLUMNS,
  READ_COLUMNS,
  TRAIT_MAX,
  type TraitColumn,
} from "@/lib/trait-columns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------- types ----------

export interface StudentRow {
  id: number;
  code: string;
  name: string;
  room: number;
  no: number;
}

export interface ScoreTab {
  category: ScoreCategory;
  label: string;
  items: { id: number; name: string; max: number }[];
}

interface Column {
  key: string; // prefix ของ cell key
  header: string;
  max: number;
  intOnly: boolean;
  ref: { type: "score"; itemId: number } | { type: "trait"; kind: TraitKind };
}

type TabId = ScoreCategory | "BEHAVIOR" | "READ" | "COMPETENCY";

interface TabDef {
  id: TabId;
  label: string;
  shortLabel: string;
  columns: Column[];
  sumLabel: string | null; // null = ไม่แสดงคอลัมน์รวม
  sumMode: "sum" | "mode";
}

function scoreCellKey(itemId: number, studentId: number) {
  return `s:${itemId}:${studentId}`;
}
function traitCellKey(kind: TraitKind, studentId: number) {
  return `t:${kind}:${studentId}`;
}

function traitColumns(cols: TraitColumn[]): Column[] {
  return cols.map((c) => ({
    key: `t:${c.kind}`,
    header: c.label, // ตรงกับหัวคอลัมน์ template (ช่องสำรองเป็นตัวเลขเหมือนในไฟล์จริง)
    max: TRAIT_MAX,
    intOnly: true,
    ref: { type: "trait", kind: c.kind },
  }));
}

/** ตรวจค่าหนึ่งช่อง — คืน error message หรือ parsed value */
function parseCell(raw: string, col: Column): { value?: number | null; error?: string } {
  const text = raw.trim();
  if (text === "") return { value: null };
  const value = Number(text);
  if (!Number.isFinite(value)) return { error: "ไม่ใช่ตัวเลข" };
  if (value < 0) return { error: "ติดลบไม่ได้" };
  if (value > col.max) return { error: `เกินเต็ม ${col.max}` };
  if (col.intOnly && !Number.isInteger(value)) return { error: "ต้องเป็นจำนวนเต็ม" };
  if (Math.round(value * 100) !== value * 100) return { error: "ทศนิยมเกิน 2 ตำแหน่ง" };
  return { value };
}

/** ฐานนิยมตัวมากสุด (เหมือนสูตร MODE.MULT ใน template) — null ถ้าไม่มีค่าซ้ำ */
function modeMax(values: number[]): number | null {
  const freq = new Map<number, number>();
  for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1);
  let best = 0;
  for (const c of freq.values()) best = Math.max(best, c);
  if (best < 2) return null;
  let result: number | null = null;
  for (const [v, c] of freq) if (c === best && (result === null || v > result)) result = v;
  return result;
}

// ---------- cell ----------

const Cell = memo(function Cell({
  cellKey,
  value,
  error,
  row,
  col,
  onChange,
  onKeyDown,
  onPaste,
  registerRef,
}: {
  cellKey: string;
  value: string;
  error: string | undefined;
  row: number;
  col: number;
  onChange: (key: string, raw: string, row: number, col: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => void;
  onPaste: (e: React.ClipboardEvent<HTMLInputElement>, row: number, col: number) => void;
  registerRef: (row: number, col: number, el: HTMLInputElement | null) => void;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      title={error}
      ref={(el) => registerRef(row, col, el)}
      onChange={(e) => onChange(cellKey, e.target.value, row, col)}
      onKeyDown={(e) => onKeyDown(e, row, col)}
      onPaste={(e) => onPaste(e, row, col)}
      onFocus={(e) => e.target.select()}
      className={cn(
        "h-8 w-16 rounded border bg-background text-center text-sm outline-none",
        "focus:border-primary focus:ring-1 focus:ring-primary",
        error && "border-destructive bg-destructive/10 text-destructive focus:border-destructive focus:ring-destructive",
      )}
    />
  );
});

// ---------- workbench ----------

export function ScoreWorkbench({
  subjectId,
  scoreTabs,
  students,
  rooms,
  initialScores,
  initialTraits,
}: {
  subjectId: number;
  scoreTabs: ScoreTab[];
  students: StudentRow[];
  rooms: number[];
  initialScores: { itemId: number; studentId: number; value: number | null }[];
  initialTraits: { kind: TraitKind; studentId: number; value: number | null }[];
}) {
  const tabs: TabDef[] = useMemo(() => {
    const sc: TabDef[] = scoreTabs.map((t) => ({
      id: t.category,
      label: t.label,
      shortLabel: t.label.replace("คะแนน", ""),
      columns: t.items.map((i) => ({
        key: `s:${i.id}`,
        header: i.name,
        max: i.max,
        intOnly: false,
        ref: { type: "score", itemId: i.id },
      })),
      sumLabel: "รวม",
      sumMode: "sum",
    }));
    const tr: TabDef[] = [
      { id: "BEHAVIOR", label: "คุณลักษณะอันพึงประสงค์", shortLabel: "คุณลักษณะฯ", columns: traitColumns(BEHAVIOR_COLUMNS), sumLabel: "รวม*", sumMode: "mode" },
      { id: "READ", label: "อ่านคิดวิเคราะห์", shortLabel: "อ่านคิดฯ", columns: traitColumns(READ_COLUMNS), sumLabel: "รวม*", sumMode: "mode" },
      { id: "COMPETENCY", label: "สมรรถนะ", shortLabel: "สมรรถนะ", columns: traitColumns(COMPETENCY_COLUMNS), sumLabel: "รวม*", sumMode: "mode" },
    ];
    return [...sc, ...tr];
  }, [scoreTabs]);

  const [activeTabId, setActiveTabId] = useState<TabId>(tabs[0].id);
  const activeTab = tabs.find((t) => t.id === activeTabId)!;
  const [roomFilter, setRoomFilter] = useState<string>(rooms.length === 1 ? String(rooms[0]) : "all");

  // ---------- ค่าในตาราง ----------
  const [values, setValues] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const s of initialScores) {
      if (s.value !== null) m.set(scoreCellKey(s.itemId, s.studentId), String(s.value));
    }
    for (const t of initialTraits) {
      if (t.value !== null) m.set(traitCellKey(t.kind, t.studentId), String(t.value));
    }
    return m;
  });
  const [errors, setErrors] = useState<Map<string, string>>(new Map());

  // ---------- คิวบันทึก ----------
  const pendingRef = useRef<Map<string, ScoreEntry | TraitEntry>>(new Map());
  const [pendingCount, setPendingCount] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushing = useRef(false);

  const queueEntry = useCallback((key: string, entry: ScoreEntry | TraitEntry) => {
    pendingRef.current.set(key, entry);
    setPendingCount(pendingRef.current.size);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flush(), 1200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flush = useCallback(async () => {
    if (flushing.current || pendingRef.current.size === 0) return;
    flushing.current = true;
    setSaveState("saving");
    const batch = [...pendingRef.current.entries()];
    const scoreEntries = batch.filter(([k]) => k.startsWith("s:")).map(([, e]) => e as ScoreEntry);
    const traitEntries = batch.filter(([k]) => k.startsWith("t:")).map(([, e]) => e as TraitEntry);
    try {
      if (scoreEntries.length > 0) {
        const r = await saveScoresAction(subjectId, scoreEntries);
        if (!r.ok) throw new Error(r.error);
      }
      if (traitEntries.length > 0) {
        const r = await saveTraitsAction(subjectId, traitEntries);
        if (!r.ok) throw new Error(r.error);
      }
      // ลบเฉพาะรายการที่ไม่ถูกแก้ระหว่างบันทึก
      for (const [k, e] of batch) {
        if (pendingRef.current.get(k) === e) pendingRef.current.delete(k);
      }
      setPendingCount(pendingRef.current.size);
      setSaveState(pendingRef.current.size === 0 ? "saved" : "idle");
      setSaveError(null);
      setSavedAt(new Date().toLocaleTimeString("th-TH"));
      if (pendingRef.current.size > 0) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => void flush(), 400);
      }
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      flushing.current = false;
    }
  }, [subjectId]);

  // เตือนก่อนปิดหน้าถ้ายังบันทึกไม่หมด
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingRef.current.size > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // ---------- แถวที่มองเห็นตาม filter ห้อง ----------
  const visibleRows = useMemo(() => {
    const list =
      roomFilter === "all" ? students : students.filter((s) => s.room === Number(roomFilter));
    return [...list].sort((a, b) => a.room - b.room || a.no - b.no);
  }, [students, roomFilter]);

  // ---------- เปลี่ยนค่า 1 ช่อง ----------
  const applyCell = useCallback(
    (key: string, raw: string, col: Column, studentId: number) => {
      setValues((prev) => {
        const next = new Map(prev);
        if (raw === "") next.delete(key);
        else next.set(key, raw);
        return next;
      });
      const parsed = parseCell(raw, col);
      setErrors((prev) => {
        const next = new Map(prev);
        if (parsed.error) next.set(key, parsed.error);
        else next.delete(key);
        return next;
      });
      if (!parsed.error) {
        if (col.ref.type === "score") {
          queueEntry(key, { itemId: col.ref.itemId, studentId, value: parsed.value! });
        } else {
          queueEntry(key, { kind: col.ref.kind, studentId, value: parsed.value as number | null });
        }
      }
    },
    [queueEntry],
  );

  const handleChange = useCallback(
    (key: string, raw: string, rowIdx: number, colIdx: number) => {
      const col = activeTab.columns[colIdx];
      const student = visibleRows[rowIdx];
      applyCell(key, raw, col, student.id);
    },
    [activeTab, visibleRows, applyCell],
  );

  // ---------- คีย์บอร์ดแบบ spreadsheet ----------
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const registerRef = useCallback((row: number, col: number, el: HTMLInputElement | null) => {
    const k = `${row}:${col}`;
    if (el) inputRefs.current.set(k, el);
    else inputRefs.current.delete(k);
  }, []);

  const focusCell = useCallback((row: number, col: number) => {
    inputRefs.current.get(`${row}:${col}`)?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
      const input = e.currentTarget;
      const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
      const atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
      const move = (r: number, c: number) => {
        e.preventDefault();
        focusCell(r, c);
      };
      switch (e.key) {
        case "Enter":
          move(row + (e.shiftKey ? -1 : 1), col);
          break;
        case "ArrowDown":
          move(row + 1, col);
          break;
        case "ArrowUp":
          move(row - 1, col);
          break;
        case "ArrowLeft":
          if (atStart || input.value === "" || input.selectionEnd !== input.selectionStart) move(row, col - 1);
          break;
        case "ArrowRight":
          if (atEnd || input.value === "") move(row, col + 1);
          break;
      }
    },
    [focusCell],
  );

  // ---------- paste จาก Excel ----------
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>, startRow: number, startCol: number) => {
      const text = e.clipboardData.getData("text");
      if (!text.includes("\t") && !text.includes("\n")) return; // ค่าเดี่ยว ปล่อย default
      e.preventDefault();
      const lines = text.replace(/\r/g, "").split("\n");
      if (lines[lines.length - 1] === "") lines.pop();
      let filled = 0;
      let skipped = 0;
      for (let r = 0; r < lines.length; r++) {
        const rowIdx = startRow + r;
        if (rowIdx >= visibleRows.length) break;
        const cells = lines[r].split("\t");
        for (let c = 0; c < cells.length; c++) {
          const colIdx = startCol + c;
          if (colIdx >= activeTab.columns.length) break;
          const col = activeTab.columns[colIdx];
          const student = visibleRows[rowIdx];
          const key =
            col.ref.type === "score"
              ? scoreCellKey(col.ref.itemId, student.id)
              : traitCellKey(col.ref.kind, student.id);
          const raw = cells[c].trim();
          applyCell(key, raw, col, student.id);
          if (parseCell(raw, col).error) skipped++;
          else filled++;
        }
      }
      setLastAction(
        `วางข้อมูล ${filled} ช่อง${skipped > 0 ? ` (ไม่ผ่าน ${skipped} ช่อง — ดูช่องสีแดง)` : ""}`,
      );
    },
    [visibleRows, activeTab, applyCell],
  );

  // ---------- ใส่เต็ม + undo ----------
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [undoData, setUndoData] = useState<{
    label: string;
    prev: { key: string; raw: string | undefined; col: Column; studentId: number }[];
  } | null>(null);

  const fillCells = useCallback(
    (cols: Column[], overwrite: boolean, label: string) => {
      const prev: { key: string; raw: string | undefined; col: Column; studentId: number }[] = [];
      let filled = 0;
      for (const col of cols) {
        for (const s of visibleRows) {
          const key =
            col.ref.type === "score" ? scoreCellKey(col.ref.itemId, s.id) : traitCellKey(col.ref.kind, s.id);
          const current = values.get(key);
          if (!overwrite && current !== undefined && current !== "") continue;
          prev.push({ key, raw: current, col, studentId: s.id });
          applyCell(key, String(col.max), col, s.id);
          filled++;
        }
      }
      setUndoData(filled > 0 ? { label, prev } : null);
      setLastAction(
        filled > 0
          ? `${label}: ใส่เต็ม ${filled} ช่อง${overwrite ? " (ทับของเดิม)" : " (เฉพาะช่องว่าง)"}`
          : `${label}: ไม่มีช่องว่างให้เติม`,
      );
    },
    [visibleRows, values, applyCell],
  );

  const undo = useCallback(() => {
    if (!undoData) return;
    for (const p of undoData.prev) {
      applyCell(p.key, p.raw ?? "", p.col, p.studentId);
    }
    setLastAction(`เลิกทำ "${undoData.label}" แล้ว (${undoData.prev.length} ช่อง)`);
    setUndoData(null);
  }, [undoData, applyCell]);

  // ---------- รวมต่อแถว ----------
  const rowSummary = useCallback(
    (studentId: number): string => {
      const nums: number[] = [];
      for (const col of activeTab.columns) {
        const key =
          col.ref.type === "score" ? scoreCellKey(col.ref.itemId, studentId) : traitCellKey(col.ref.kind, studentId);
        if (errors.has(key)) continue;
        const raw = values.get(key);
        if (raw === undefined || raw.trim() === "") continue;
        const n = Number(raw);
        if (Number.isFinite(n)) nums.push(n);
      }
      if (nums.length === 0) return "";
      if (activeTab.sumMode === "sum") {
        const sum = nums.reduce((a, b) => a + b, 0);
        return String(Math.round(sum * 100) / 100);
      }
      const m = modeMax(nums);
      return m === null ? "—" : String(m);
    },
    [activeTab, values, errors],
  );

  const errorCount = errors.size;
  const maxTotal = activeTab.columns.reduce((a, c) => a + c.max, 0);

  // ---------- render ----------
  let lastRoom: number | null = null;

  return (
    <div className="space-y-3">
      {/* แถบแท็บ */}
      <div className="flex flex-wrap gap-1 rounded-lg border bg-background p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTabId(t.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              t.id === activeTabId
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t.shortLabel}
            {t.columns.length === 0 && " (ว่าง)"}
          </button>
        ))}
      </div>

      {/* แถบเครื่องมือ */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={roomFilter} onValueChange={setRoomFilter}>
          <SelectTrigger className="w-32">
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

        {activeTab.columns.length > 0 && (
          <>
            <Button variant="outline" size="sm" onClick={() => fillCells(activeTab.columns, false, `เติมทั้งแท็บ${activeTab.shortLabel}`)}>
              ใส่เต็มช่องว่างทั้งแท็บ
            </Button>
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm" className="text-destructive">
                  ใส่เต็มทับทั้งหมด
                </Button>
              }
              title="ใส่คะแนนเต็มทับทุกช่อง?"
              description={`จะใส่คะแนนเต็มทับทุกช่องของแท็บ "${activeTab.label}" เฉพาะนักเรียนที่แสดงอยู่ตามตัวกรองห้อง — กดเลิกทำย้อนกลับได้ 1 ครั้ง`}
              confirmLabel="ใส่เต็มทับทั้งหมด"
              destructive
              onConfirm={() => fillCells(activeTab.columns, true, `เติมทับทั้งแท็บ${activeTab.shortLabel}`)}
            />
          </>
        )}
        {undoData && (
          <Button variant="secondary" size="sm" onClick={undo}>
            ↩ เลิกทำ
          </Button>
        )}

        <div className="ms-auto flex items-center gap-2 text-sm">
          {errorCount > 0 && <Badge variant="destructive">{errorCount} ช่องไม่ถูกต้อง — ไม่ถูกบันทึก</Badge>}
          {pendingCount > 0 ? (
            <>
              <span className="text-muted-foreground">
                {saveState === "saving" ? "กำลังบันทึก…" : `ค้างบันทึก ${pendingCount} ช่อง`}
              </span>
              <Button size="sm" onClick={() => void flush()} disabled={saveState === "saving"}>
                บันทึกเดี๋ยวนี้
              </Button>
            </>
          ) : saveState === "saved" && savedAt ? (
            <span className="text-muted-foreground">บันทึกแล้ว {savedAt}</span>
          ) : null}
          {saveState === "error" && (
            <>
              <Badge variant="destructive">{saveError ?? "บันทึกไม่สำเร็จ"}</Badge>
              <Button size="sm" variant="outline" onClick={() => void flush()}>
                ลองอีกครั้ง
              </Button>
            </>
          )}
        </div>
      </div>

      {lastAction && <p className="text-sm text-muted-foreground">{lastAction}</p>}

      {/* ตาราง */}
      {activeTab.columns.length === 0 ? (
        <div className="rounded-lg border bg-background p-8 text-center text-sm text-muted-foreground">
          แท็บนี้ยังไม่มีหัวข้อคะแนน — เพิ่มได้ที่หน้าตั้งค่าวิชา
        </div>
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded-lg border bg-background">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-20">
              <tr className="border-b bg-muted">
                <th className="sticky left-0 z-10 bg-muted px-2 py-2 text-left font-medium">เลขที่</th>
                <th className="px-2 py-2 text-left font-medium">รหัส</th>
                <th className="min-w-44 px-2 py-2 text-left font-medium">ชื่อ-นามสกุล</th>
                {activeTab.columns.map((col, ci) => (
                  <th key={col.key} className="px-1 py-2 text-center align-bottom font-medium">
                    <div className="mx-auto max-w-24 truncate" title={col.header}>
                      {col.header}
                    </div>
                    <div className="font-normal text-muted-foreground">เต็ม {col.max}</div>
                    <button
                      className="mt-1 rounded border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                      title={`ใส่ ${col.max} ให้ทุกช่องว่างของคอลัมน์นี้`}
                      onClick={() => fillCells([activeTab.columns[ci]], false, `เติมคอลัมน์ "${col.header}"`)}
                    >
                      เติม
                    </button>
                  </th>
                ))}
                {activeTab.sumLabel && (
                  <th className="px-2 py-2 text-center font-medium">
                    {activeTab.sumLabel}
                    {activeTab.sumMode === "sum" && (
                      <div className="font-normal text-muted-foreground">เต็ม {maxTotal}</div>
                    )}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((s, rowIdx) => {
                const showRoomHeader = roomFilter === "all" && s.room !== lastRoom;
                lastRoom = s.room;
                return (
                  <FragmentRow
                    key={s.id}
                    showRoomHeader={showRoomHeader}
                    roomLabel={`ห้อง ${s.room}`}
                    colSpan={3 + activeTab.columns.length + (activeTab.sumLabel ? 1 : 0)}
                  >
                    <tr className="border-b last:border-0 odd:bg-muted/20 hover:bg-primary/5">
                      <td className="sticky left-0 z-10 bg-background px-2 py-1 font-medium">{s.no}</td>
                      <td className="px-2 py-1 text-muted-foreground">{s.code}</td>
                      <td className="px-2 py-1 whitespace-nowrap">{s.name}</td>
                      {activeTab.columns.map((col, colIdx) => {
                        const key =
                          col.ref.type === "score"
                            ? scoreCellKey(col.ref.itemId, s.id)
                            : traitCellKey(col.ref.kind, s.id);
                        return (
                          <td key={col.key} className="px-1 py-1 text-center">
                            <Cell
                              cellKey={key}
                              value={values.get(key) ?? ""}
                              error={errors.get(key)}
                              row={rowIdx}
                              col={colIdx}
                              onChange={handleChange}
                              onKeyDown={handleKeyDown}
                              onPaste={handlePaste}
                              registerRef={registerRef}
                            />
                          </td>
                        );
                      })}
                      {activeTab.sumLabel && (
                        <td className="px-2 py-1 text-center font-medium">{rowSummary(s.id)}</td>
                      )}
                    </tr>
                  </FragmentRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab.sumMode === "mode" && activeTab.columns.length > 0 && (
        <p className="text-xs text-muted-foreground">
          * รวมของส่วนนี้คิดแบบฐานนิยม (ค่าที่ปรากฏบ่อยสุด เลือกตัวมากสุดเมื่อเสมอ) ตามสูตรในไฟล์
          SchoolBright — &quot;—&quot; = ไม่มีค่าซ้ำเลย ระบบจะเว้นว่างตอน export
        </p>
      )}
    </div>
  );
}

/** แถว section หัวห้อง (โหมดทุกห้อง) + แถวข้อมูล */
function FragmentRow({
  showRoomHeader,
  roomLabel,
  colSpan,
  children,
}: {
  showRoomHeader: boolean;
  roomLabel: string;
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <>
      {showRoomHeader && (
        <tr className="border-b bg-muted/60">
          <td colSpan={colSpan} className="px-2 py-1 text-xs font-semibold text-muted-foreground">
            {roomLabel}
          </td>
        </tr>
      )}
      {children}
    </>
  );
}
