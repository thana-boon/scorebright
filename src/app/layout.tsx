import type { Metadata } from "next";
import { Kanit } from "next/font/google";
import "./globals.css";

// ฟอนต์ของหน้าเว็บเท่านั้น — ไม่กระทบไฟล์ export (ExcelJS ใช้ฟอนต์ของ template เดิม)
const kanit = Kanit({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-kanit",
});

export const metadata: Metadata = {
  title: "ScoreBright — ระบบบันทึกคะแนน",
  description: "บันทึกคะแนนนักเรียนและ export เข้า SchoolBright",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${kanit.variable} font-sans`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
