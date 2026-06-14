"use server";

import { redirect } from "next/navigation";
import { createSession, verifyCredentials } from "@/lib/auth";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!username || !password) {
    return { error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" };
  }

  let user;
  try {
    user = await verifyCredentials(username, password);
  } catch (err) {
    console.error("login: database error", err);
    return { error: "เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาแจ้งผู้ดูแลระบบ" };
  }
  if (!user) {
    return { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
  }

  await createSession(user);
  redirect("/");
}
