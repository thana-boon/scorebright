import "server-only";

/**
 * รายชื่อครู + การตรวจรหัสผ่านครู ผ่าน Teacher API (timetable-auth-api)
 * แหล่งข้อมูล: http://192.168.200.9/teacher-api (ดู USAGE.md)
 * - listTeachers()  ต้องการ scope teachers:read — ใช้ตอนซิงค์รายชื่อ
 * - loginTeacher()  ต้องการ scope auth:login   — ใช้ proxy ตรวจรหัสตอน login
 * ตั้งค่า TEACHER_API_BASE_URL / TEACHER_API_KEY ใน .env
 * บัญชี/role ยังเป็นของ ScoreBright เอง — API นี้ไม่เก็บ role และไม่คืน password_hash
 */

const API_BASE = process.env.TEACHER_API_BASE_URL ?? "http://192.168.200.9/teacher-api";
const API_KEY = process.env.TEACHER_API_KEY ?? "";

/** รูปแบบครูที่ API คืนมา (ตัด password_hash ออกแล้วเสมอ) */
export interface ApiTeacher {
  id: number;
  teacher_code: string;
  title: string | null;
  first_name: string;
  last_name: string;
  first_name_en: string | null;
  last_name_en: string | null;
  email: string | null;
  created_at: string;
  subject_group: number | null;
}

/** ชื่อที่แสดงในระบบ เช่น "นายธนา บุญชู" (title ต่อกับชื่อ ตามแบบไทย) */
export function teacherDisplayName(t: Pick<ApiTeacher, "title" | "first_name" | "last_name">): string {
  return `${t.title ?? ""}${t.first_name} ${t.last_name}`.trim();
}

/** ดึงรายชื่อครูทั้งหมด (รวมรหัสขึ้นต้น A ที่ login ไม่ได้) — scope teachers:read */
export async function listTeachers(): Promise<ApiTeacher[]> {
  const res = await fetch(`${API_BASE}/api/teachers`, {
    headers: { "x-api-key": API_KEY },
    cache: "no-store", // ซิงค์ต้องได้รายชื่อล่าสุดเสมอ
  });
  if (!res.ok) {
    let detail = String(res.status);
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = `${res.status} ${body.error}`;
    } catch {
      /* body ไม่ใช่ JSON */
    }
    throw new Error(`Teacher API /api/teachers ล้มเหลว: ${detail}`);
  }
  return res.json() as Promise<ApiTeacher[]>;
}

/**
 * ตรวจรหัสครูที่ teacher-api — scope auth:login
 * คืนข้อมูลครูถ้าถูกต้อง (200), null ถ้ารหัสผิด/ครู login ไม่ได้ (401)
 * โยน error เฉพาะกรณีระบบล้มจริง (เพื่อให้แยก "รหัสผิด" กับ "API ล่ม" ได้)
 */
export async function loginTeacher(teacherCode: string, password: string): Promise<ApiTeacher | null> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({ teacher_code: teacherCode, password }),
    cache: "no-store",
  });
  if (res.status === 200) {
    return res.json() as Promise<ApiTeacher>;
  }
  if (res.status === 401) {
    return null; // รหัสผิด หรือ ครูไม่มีสิทธิ์ login (เช่นรหัสขึ้นต้น A)
  }
  let detail = String(res.status);
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) detail = `${res.status} ${body.error}`;
  } catch {
    /* body ไม่ใช่ JSON */
  }
  throw new Error(`Teacher API /api/auth/login ล้มเหลว: ${detail}`);
}
