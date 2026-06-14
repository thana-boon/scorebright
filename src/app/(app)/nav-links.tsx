"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarRange, Users, BookOpen, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "หน้าหลัก", icon: LayoutDashboard },
    { href: "/setup", label: "ปีการศึกษา", icon: CalendarRange },
    { href: "/students", label: "รายชื่อนักเรียน", icon: Users },
    { href: "/subjects", label: "วิชาของฉัน", icon: BookOpen },
    ...(isAdmin ? [{ href: "/users", label: "ผู้ใช้", icon: UserCog }] : []),
  ];

  return (
    <nav className="flex items-center gap-1 text-sm">
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
