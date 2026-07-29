"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/home", icon: "⌂", label: "今日" },
  { href: "/wishes", icon: "◇", label: "夢" },
  { href: "/habits", icon: "✓", label: "習慣" },
  { href: "/status", icon: "✦", label: "成長" },
  { href: "/settings", icon: "◉", label: "設定" }
] as const;

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label="メインナビゲーション">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href === "/status" && pathname.startsWith("/reports/"));
        return (
        <Link
          aria-current={active ? "page" : undefined}
          className={active ? "is-active" : ""}
          href={item.href}
          key={item.href}
        >
          <span aria-hidden="true" className="nav-icon">
            {item.icon}
          </span>
          <span>{item.label}</span>
        </Link>
        );
      })}
    </nav>
  );
}
