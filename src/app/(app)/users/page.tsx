import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateUserDialog, UsersTable } from "./users-client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = (await getSession())!;
  if (session.role !== "admin") redirect("/");

  const users = await prisma.user.findMany({
    include: { _count: { select: { subjects: true } } },
    orderBy: [{ isActive: "desc" }, { username: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">จัดการผู้ใช้</h1>
          <p className="text-sm text-muted-foreground">
            บัญชีของระบบ ScoreBright — ครูแต่ละคนเห็นเฉพาะวิชาของตัวเอง
          </p>
        </div>
        <CreateUserDialog />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">ผู้ใช้ทั้งหมด ({users.length})</CardTitle>
          <CardDescription>
            ปิดใช้งานบัญชี = login ไม่ได้ แต่วิชาและคะแนนที่เคยบันทึกยังอยู่ครบ เปิดกลับได้ทุกเมื่อ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsersTable
            selfId={session.uid}
            users={users.map((u) => ({
              id: u.id,
              username: u.username,
              displayName: u.displayName,
              role: u.role,
              isActive: u.isActive,
              subjectCount: u._count.subjects,
              createdAt: u.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
