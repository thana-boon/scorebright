/**
 * basePath ของแอป (prod = /scorebright, dev = "")
 * ใช้กับลิงก์ที่เป็น <a href> ธรรมดา — Next เติม basePath ให้เฉพาะ next/link, redirect(), router
 * ลิงก์ดาวน์โหลดไฟล์ (<a download>) ต้องเติมเอง
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
