import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, LogOut } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getWorkingPeriod } from "@/lib/app-setting";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logoutAction } from "./actions";
import { NavLinks } from "./nav-links";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login"); // proxy กันชั้นแรกแล้ว — กันเหนียวอีกชั้น

  let period = null;
  try {
    period = await getWorkingPeriod();
  } catch (err) {
    console.error("layout: โหลด AppSetting ไม่ได้", err);
  }

  const roleLabel = session.role === "admin" ? "ผู้ดูแลระบบ" : "ครู";

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="size-5" />
            </span>
            Score<span className="text-muted-foreground">Bright</span>
          </Link>
          <NavLinks isAdmin={session.role === "admin"} />
          <div className="ms-auto flex items-center gap-2">
            <Link href="/setup" title="เปลี่ยนปีการศึกษา/ภาคเรียน">
              <Badge variant={period ? "secondary" : "destructive"}>
                {period
                  ? `ปีการศึกษา ${period.workingYearBE} · เทอม ${period.workingSemester}`
                  : "ยังไม่ได้กำหนดปีการศึกษา"}
              </Badge>
            </Link>
            <div className="hidden text-end leading-tight md:block">
              <div className="text-sm font-medium">{session.displayName}</div>
              <div className="text-xs text-muted-foreground">{roleLabel}</div>
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="sm" title="ออกจากระบบ">
                <LogOut className="size-4" />
                <span className="hidden sm:inline">ออกจากระบบ</span>
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-6 text-center text-xs text-muted-foreground">
        ScoreBright — บันทึกคะแนนและส่งออกเข้า SchoolBright
      </footer>
    </div>
  );
}
