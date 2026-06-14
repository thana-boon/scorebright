"use client";

import { useActionState, useState } from "react";
import { saveScoreConfigAction, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export interface ConfigValues {
  ratioBeforeMid: number;
  ratioMid: number;
  ratioAfterMid: number;
  ratioFinal: number;
  passPercent: number;
}

const RATIO_FIELDS = [
  ["ratioBeforeMid", "เก็บก่อนกลางภาค"],
  ["ratioMid", "กลางภาค"],
  ["ratioAfterMid", "เก็บหลังกลางภาค"],
  ["ratioFinal", "ปลายภาค"],
] as const;

export function ConfigForm({
  subjectId,
  initial,
}: {
  subjectId: number;
  initial: ConfigValues | null;
}) {
  const action = saveScoreConfigAction.bind(null, subjectId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const [values, setValues] = useState<ConfigValues>(
    initial ?? { ratioBeforeMid: 30, ratioMid: 20, ratioAfterMid: 20, ratioFinal: 30, passPercent: 50 },
  );
  const sum = values.ratioBeforeMid + values.ratioMid + values.ratioAfterMid + values.ratioFinal;

  function setField(field: keyof ConfigValues, raw: string) {
    setValues((v) => ({ ...v, [field]: raw === "" ? 0 : Number(raw) }));
  }

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state.saved && (
        <Alert>
          <AlertDescription>บันทึกสัดส่วนแล้ว</AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {RATIO_FIELDS.map(([field, label]) => (
          <div key={field} className="space-y-1.5">
            <Label htmlFor={field} className="text-xs">
              {label}
            </Label>
            <Input
              id={field}
              name={field}
              type="number"
              min={0}
              max={100}
              required
              value={values[field]}
              onChange={(e) => setField(field, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="passPercent" className="text-xs">
            % ตัดผ่านของคะแนนเก็บ/ตัวชี้วัด
          </Label>
          <Input
            id="passPercent"
            name="passPercent"
            type="number"
            min={0}
            max={100}
            required
            className="w-32"
            value={values.passPercent}
            onChange={(e) => setField("passPercent", e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={sum === 100 ? "secondary" : "destructive"}>รวม {sum}/100</Badge>
          <Button type="submit" disabled={pending || sum !== 100}>
            {pending ? "กำลังบันทึก…" : "บันทึกสัดส่วน"}
          </Button>
        </div>
      </div>
    </form>
  );
}
