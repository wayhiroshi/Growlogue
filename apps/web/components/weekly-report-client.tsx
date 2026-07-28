"use client";

import { categories } from "@growlogue/content";
import {
  addGameDays,
  isGameDate,
  startOfIsoWeek,
  type WeeklyReportView
} from "@/lib/weekly-report-domain";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const weekdayLabels = ["月", "火", "水", "木", "金", "土", "日"];
const categoryMap = new Map<string, (typeof categories)[number]>(
  categories.map((category) => [category.key, category])
);

function shortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function WeeklyReportClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedWeek = searchParams.get("week");
  const validWeek =
    requestedWeek &&
    isGameDate(requestedWeek) &&
    startOfIsoWeek(requestedWeek) === requestedWeek
      ? requestedWeek
      : null;
  const [report, setReport] = useState<WeeklyReportView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setError("");
      const query = validWeek
        ? `?weekStart=${encodeURIComponent(validWeek)}`
        : "";
      const response = await fetch(`/api/v1/reports/weekly${query}`, {
        signal: controller.signal
      });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        setError("週間レポートを読み込めませんでした。");
        return;
      }
      const body = (await response.json()) as { report: WeeklyReportView };
      setReport(body.report);
    };
    void load().catch((loadError: unknown) => {
      if (
        loadError instanceof DOMException &&
        loadError.name === "AbortError"
      ) {
        return;
      }
      setError("週間レポートを読み込めませんでした。");
    });
    return () => controller.abort();
  }, [router, validWeek]);

  if (error) {
    return <p className="card my-5 p-5 text-sm font-bold">{error}</p>;
  }
  if (!report) {
    return (
      <div className="card my-5 p-5 text-sm text-[#667269]">
        一週間の歩みを読み込んでいます…
      </div>
    );
  }

  const moveWeek = (weekStart: string) => {
    setReport(null);
    router.push(`/reports/weekly?week=${weekStart}`);
  };

  return (
    <>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          className="button-secondary min-h-0 px-4 py-2 text-sm"
          type="button"
          onClick={() => moveWeek(addGameDays(report.weekStart, -7))}
        >
          ← 前週
        </button>
        <p className="text-center text-sm font-bold text-[#667269]">
          {shortDate(report.weekStart)}〜{shortDate(report.weekEnd)}
        </p>
        <button
          className="button-secondary min-h-0 px-4 py-2 text-sm"
          type="button"
          onClick={() => moveWeek(addGameDays(report.weekStart, 7))}
        >
          次週 →
        </button>
      </div>

      <section className="card my-5 overflow-hidden">
        <div className="bg-[#173f35] p-5 text-white">
          <p className="text-xs font-black tracking-widest text-[#d9bd84]">
            LUCIEN&apos;S REVIEW
          </p>
          <h2 className="serif mt-2 text-2xl font-semibold">
            {report.headline}
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/80">
            {report.lucienComment}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-px bg-[#173f3515]">
          <div className="bg-white/80 p-4 text-center">
            <strong className="block text-2xl">
              {report.totals.completed}
            </strong>
            <span className="text-[10px] font-bold text-[#667269]">達成</span>
          </div>
          <div className="bg-white/80 p-4 text-center">
            <strong className="block text-2xl">
              {report.totals.earnedXp}
            </strong>
            <span className="text-[10px] font-bold text-[#667269]">獲得XP</span>
          </div>
          <div className="bg-white/80 p-4 text-center">
            <strong className="block text-2xl">
              {report.totals.completionRate}%
            </strong>
            <span className="text-[10px] font-bold text-[#667269]">達成率</span>
          </div>
        </div>
      </section>

      <section className="card mb-5 p-5">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="eyebrow">Seven days</p>
            <h2 className="serif text-xl font-semibold">一週間の歩み</h2>
          </div>
          <p className="text-xs font-bold text-[#667269]">
            Clear {report.totals.dailyClearDays} / Perfect{" "}
            {report.totals.perfectDays}
          </p>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {report.days.map((day, index) => {
            const percent =
              day.totalMissions === 0
                ? 0
                : Math.round(
                    (day.completedMissions / day.totalMissions) * 100
                  );
            return (
              <div key={day.gameDate} className="text-center">
                <span className="text-[10px] font-bold text-[#667269]">
                  {weekdayLabels[index]}
                </span>
                <div className="mt-2 flex h-24 items-end overflow-hidden rounded-full bg-[#e8e3d8]">
                  <div
                    className={`w-full rounded-full ${
                      day.isPerfect ? "bg-[#bd8d39]" : "bg-[#173f35]"
                    }`}
                    style={{
                      height: `${Math.max(percent > 0 ? 8 : 0, percent)}%`
                    }}
                    title={`${day.completedMissions}/${day.totalMissions}`}
                  />
                </div>
                <span className="mt-2 block text-[10px] font-black">
                  {day.isPerfect ? "★" : `${day.completedMissions}`}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card mb-5 p-5">
        <p className="eyebrow">Growth</p>
        <h2 className="serif text-xl font-semibold">今週伸びた能力</h2>
        <div className="mt-4 space-y-3">
          {report.categoryXp.length > 0 ? (
            report.categoryXp.map((status) => {
              const category = categoryMap.get(status.statusKey);
              return (
                <div
                  key={status.statusKey}
                  className="flex items-center justify-between rounded-xl bg-[#f1ecdf] px-4 py-3"
                >
                  <span className="font-bold">
                    {category?.icon ?? "✦"}{" "}
                    {category?.statusName ?? status.statusKey}
                  </span>
                  <strong className="text-[#bd8d39]">
                    {status.earnedXp >= 0 ? "+" : ""}
                    {status.earnedXp} XP
                  </strong>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-[#667269]">
              この週の能力XPはまだありません。
            </p>
          )}
        </div>
      </section>

      <section className="card mb-8 grid grid-cols-2 gap-4 p-5">
        <div>
          <span className="text-xs font-bold text-[#667269]">
            現在の連続記録
          </span>
          <strong className="serif mt-1 block text-3xl">
            {report.streak.currentDays}日
          </strong>
        </div>
        <div>
          <span className="text-xs font-bold text-[#667269]">
            最多達成Habit
          </span>
          <strong className="mt-1 block text-sm leading-6">
            {report.topHabit
              ? `${report.topHabit.title} ${report.topHabit.completedCount}回`
              : "まだありません"}
          </strong>
        </div>
      </section>
    </>
  );
}
