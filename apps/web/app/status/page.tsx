import { AppNav } from "@/components/app-nav";
import { categories } from "@growlogue/content";
import { ensureUserFoundation, getDashboard } from "@/lib/game-service";
import { requireSession } from "@/lib/session";
import Link from "next/link";

export const metadata = { title: "能力値" };
export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const session = await requireSession();
  await ensureUserFoundation(session.user.id);
  const dashboard = await getDashboard(session.user.id);
  const statusMap = new Map(dashboard.statuses.map((status) => [status.statusKey, status.xp]));
  const maxXp = Math.max(100, ...dashboard.statuses.map((status) => status.xp));

  return (
    <main className="app-shell">
      <p className="eyebrow">Character sheet</p>
      <h1 className="serif text-3xl font-semibold">あなたの能力値</h1>
      <section className="card my-6 grid grid-cols-2 gap-4 p-5">
        <div>
          <span className="text-xs font-bold text-[#667269]">Gentleman Level</span>
          <strong className="serif mt-1 block text-4xl">{dashboard.progress.level}</strong>
        </div>
        <div>
          <span className="text-xs font-bold text-[#667269]">累計XP</span>
          <strong className="serif mt-1 block text-4xl">{dashboard.progress.totalXp}</strong>
        </div>
        <div>
          <span className="text-xs font-bold text-[#667269]">Daily Clear</span>
          <strong className="mt-1 block text-2xl">{dashboard.progress.dailyClearCount}日</strong>
        </div>
        <div>
          <span className="text-xs font-bold text-[#667269]">Perfect</span>
          <strong className="mt-1 block text-2xl">{dashboard.progress.perfectCount}回</strong>
        </div>
      </section>

      <section className="card space-y-5 p-5">
        {categories.map((category) => {
          const xp = statusMap.get(category.key) ?? 0;
          return (
            <div key={category.id}>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-bold">{category.icon} {category.statusName}</span>
                <span className="text-xs font-black text-[#bd8d39]">{xp} XP</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#e8e3d8]">
                <div
                  className="h-full rounded-full bg-[#173f35]"
                  style={{ width: `${Math.max(2, (xp / maxXp) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </section>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link
          className="button-secondary w-full text-center"
          href="/reports/weekly"
        >
          週間レポート
        </Link>
        <Link
          className="button-secondary w-full text-center"
          href="/reports/monthly"
        >
          月間レポート
        </Link>
      </div>
      <AppNav />
    </main>
  );
}
