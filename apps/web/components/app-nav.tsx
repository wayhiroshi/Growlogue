import Link from "next/link";

const items = [
  { href: "/home", icon: "♜", label: "今日" },
  { href: "/habits", icon: "✓", label: "習慣" },
  { href: "/status", icon: "✦", label: "能力" },
  { href: "/settings", icon: "⚙", label: "設定" }
] as const;

export function AppNav() {
  return (
    <nav className="bottom-nav" aria-label="メインナビゲーション">
      {items.map((item) => (
        <Link href={item.href} key={item.href}>
          <span aria-hidden="true" className="text-lg leading-none">
            {item.icon}
          </span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
