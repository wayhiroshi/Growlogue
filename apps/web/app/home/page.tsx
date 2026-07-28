import { AppNav } from "@/components/app-nav";
import { MissionList } from "@/components/mission-list";
import { ensureUserFoundation, getDashboard } from "@/lib/game-service";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata = { title: "今日のミッション" };
export const dynamic = "force-dynamic";

const dayModeLabels = {
  NORMAL: null,
  HOLIDAY: "休日モード",
  SICK: "体調不良モード",
  BUSY: "忙しい日モード",
  REST: "完全休息日"
} as const;

export default async function HomePage() {
  const session = await requireSession();
  const profile = await ensureUserFoundation(session.user.id);
  if (!profile.onboardingDone) redirect("/onboarding");
  const dashboard = await getDashboard(session.user.id);
  const percent =
    dashboard.daily.totalMissions === 0
      ? 0
      : Math.round(
          (dashboard.daily.totalCompleted / dashboard.daily.totalMissions) * 100
        );

  return (
    <main className="app-shell">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{dashboard.gameDate}</p>
          <h1 className="serif text-3xl font-semibold">本日の任務</h1>
        </div>
        <div className="rounded-2xl bg-[#173f35] px-4 py-3 text-right text-white">
          <span className="block text-[10px] font-bold tracking-widest opacity-65">LEVEL</span>
          <strong className="text-2xl">{dashboard.progress.level}</strong>
        </div>
      </header>

      {dayModeLabels[dashboard.dayMode] ? (
        <p className="mb-4 rounded-full bg-[#d8e5dc] px-4 py-2 text-center text-sm font-bold text-[#173f35]">
          {dayModeLabels[dashboard.dayMode]} — 無理のない一日を守ります
        </p>
      ) : null}

      <section className="card mb-5 overflow-hidden">
        <div className="flex items-center gap-4 p-5">
          <div className="grid size-16 shrink-0 place-items-center rounded-full bg-[#173f35] text-3xl text-white">
            ♟
          </div>
          <div>
            <p className="text-xs font-black tracking-widest text-[#bd8d39]">
              {dashboard.character.mood}
            </p>
            <p className="serif mt-1 leading-7">{dashboard.character.message}</p>
          </div>
        </div>
        <div className="border-t border-[#173f3515] bg-[#f1ecdf] px-5 py-3">
          <div className="mb-2 flex justify-between text-xs font-bold">
            <span>
              {dashboard.daily.totalCompleted}/{dashboard.daily.totalMissions} 完了
            </span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-[#bd8d39] transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </section>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="card p-3 text-center">
          <span className="block text-xl font-black">{dashboard.progress.totalXp}</span>
          <span className="text-[10px] font-bold text-[#667269]">TOTAL XP</span>
        </div>
        <div className="card p-3 text-center">
          <span className="block text-xl font-black">{dashboard.streak.currentDays}</span>
          <span className="text-[10px] font-bold text-[#667269]">STREAK</span>
        </div>
        <div className="card p-3 text-center">
          <span className="block text-xl font-black">
            {dashboard.daily.isPerfect ? "★" : dashboard.daily.coreCompleted}
          </span>
          <span className="text-[10px] font-bold text-[#667269]">
            {dashboard.daily.isPerfect ? "PERFECT" : "CORE"}
          </span>
        </div>
      </div>

      <MissionList missions={dashboard.missions} />
      <AppNav />
    </main>
  );
}
