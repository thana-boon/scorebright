import { GraduationCap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-muted p-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center justify-center gap-2 text-2xl font-semibold tracking-tight">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-6" />
          </span>
          Score<span className="text-muted-foreground">Bright</span>
        </div>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">เข้าสู่ระบบ</CardTitle>
            <CardDescription>
              ระบบบันทึกคะแนนและส่งออกเข้า SchoolBright
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          ลืมรหัสผ่าน? ติดต่อผู้ดูแลระบบเพื่อรีเซ็ต
        </p>
      </div>
    </main>
  );
}
