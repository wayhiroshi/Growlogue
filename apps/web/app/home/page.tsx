import { AppNav } from "@/components/app-nav";
import { CompanionHero } from "@/components/companion-hero";
import { DailyReviewCard } from "@/components/daily-review-card";
import { MissionList } from "@/components/mission-list";
import { ensureUserFoundation, getDashboard } from "@/lib/game-service";
import { getPrimaryWish } from "@/lib/life-unlocks-service";
import { requireSession } from "@/lib/session";
import { butlerMoodLabels } from "@growlogue/content";
import Link from "next/link";
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
  const [dashboard, primaryWish] = await Promise.all([
    getDashboard(session.user.id),
    getPrimaryWish(session.user.id)
  ]);
  const percent =
    dashboard.daily.totalMissions === 0
      ? 0
      : Math.round(
          (dashboard.daily.totalCompleted / dashboard.daily.totalMissions) * 100
        );
  const characterName = dashboard.character.name.split("（")[0] ?? "Lucien";

  return (
    <main className="app-shell">
      <header className="home-heading">
        <div>
          <p className="eyebrow">Today · {dashboard.gameDate}</p>
          <h1>今日も、物語を進めよう</h1>
          <p>小さな一歩を、{characterName}が見守っています。</p>
        </div>
        <div className="level-badge" aria-label={`レベル ${dashboard.progress.level}`}>
          <span>LEVEL</span>
          <strong className="text-2xl">{dashboard.progress.level}</strong>
        </div>
      </header>

      {dayModeLabels[dashboard.dayMode] ? (
        <p className="mb-4 rounded-full bg-[#d8e5dc] px-4 py-2 text-center text-sm font-bold text-[#173f35]">
          {dayModeLabels[dashboard.dayMode]} — 無理のない一日を守ります
        </p>
      ) : null}

      <CompanionHero
        avatarUrl={dashboard.character.avatarUrl}
        characterName={characterName}
        completed={dashboard.daily.totalCompleted}
        fullName={dashboard.character.name}
        message={
          dashboard.character.message ??
          "今日の小さな一歩を、ここから始めましょう。"
        }
        moodLabel={
          butlerMoodLabels[dashboard.character.mood] ?? dashboard.character.mood
        }
        percent={percent}
        tapResponses={dashboard.character.tapResponses}
        total={dashboard.daily.totalMissions}
      />

      <div className="metric-strip">
        <div>
          <span className="metric-strip__icon" aria-hidden="true">✦</span>
          <strong>{dashboard.progress.totalXp}</strong>
          <span>Total XP</span>
        </div>
        <div>
          <span className="metric-strip__icon" aria-hidden="true">♨</span>
          <strong>{dashboard.streak.currentDays}</strong>
          <span>連続日数</span>
        </div>
        <div>
          <span className="metric-strip__icon" aria-hidden="true">◎</span>
          <strong>
            {dashboard.daily.isPerfect ? "★" : dashboard.daily.coreCompleted}
          </strong>
          <span>
            {dashboard.daily.isPerfect ? "Perfect" : "Core"}
          </span>
        </div>
      </div>

      <MissionList
        key={dashboard.missions
          .map(
            (mission) =>
              `${mission.id}:${mission.status}:${mission.encore?.totalSets ?? 0}`
          )
          .join("|")}
        missions={dashboard.missions}
      />

      <section className="dream-feature">
        <div className="dream-feature__image" aria-hidden="true">
          <img
            alt=""
            height="675"
            loading="lazy"
            src="/images/scenes/life-unlocks-garden.webp"
            width="1200"
          />
        </div>
        <div className="dream-feature__body">
          <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Dreams</p>
              <h2>人生の解放</h2>
          </div>
          <Link
              className="text-link"
            href="/wishes"
          >
            すべて見る
          </Link>
        </div>
        {primaryWish ? (
            <div className="dream-progress">
              <span className="dream-progress__icon" aria-hidden="true">
                {primaryWish.status === "UNLOCKED" ? "🔓" : primaryWish.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-3">
                  <strong className="truncate">{primaryWish.title}</strong>
                    <span className="progress-percent">
                    {primaryWish.progressPercent}%
                  </span>
                </div>
                  <div className="progress-track mt-2">
                  <div
                    style={{ width: `${primaryWish.progressPercent}%` }}
                  />
                </div>
              </div>
          </div>
        ) : (
            <p className="empty-copy">
            現実で叶えたいことをWishとして登録しましょう。
            </p>
        )}
        </div>
      </section>

      <DailyReviewCard characterName={characterName} />
      <AppNav />
    </main>
  );
}
