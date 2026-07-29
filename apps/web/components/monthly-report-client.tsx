"use client";

import { categories } from "@growlogue/content";
import {
  addGameMonths,
  isMonthKey,
  type MonthlyReportView
} from "@/lib/monthly-report-domain";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];
const categoryMap = new Map<string, (typeof categories)[number]>(
  categories.map((category) => [category.key, category])
);

function monthLabel(month: string): string {
  const [year, value] = month.split("-");
  return `${year}年${Number(value)}月`;
}

export function MonthlyReportClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMonth = searchParams.get("month");
  const validMonth =
    requestedMonth && isMonthKey(requestedMonth) ? requestedMonth : null;
  const [report, setReport] = useState<MonthlyReportView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setError("");
      const query = validMonth
        ? `?month=${encodeURIComponent(validMonth)}`
        : "";
      const response = await fetch(`/api/v1/reports/monthly${query}`, {
        signal: controller.signal
      });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        setError("月間レポートを読み込めませんでした。");
        return;
      }
      const body = (await response.json()) as {
        report: MonthlyReportView;
      };
      setReport(body.report);
    };
    void load().catch((loadError: unknown) => {
      if (
        loadError instanceof DOMException &&
        loadError.name === "AbortError"
      ) {
        return;
      }
      setError("月間レポートを読み込めませんでした。");
    });
    return () => controller.abort();
  }, [router, validMonth]);

  if (error) {
    return <p className="card my-5 p-5 text-sm font-bold">{error}</p>;
  }
  if (!report) {
    return (
      <div className="card my-5 p-5 text-sm text-[#667269]">
        一か月の年代記を読み込んでいます…
      </div>
    );
  }

  const moveMonth = (months: number) => {
    const nextMonth = addGameMonths(report.monthStart, months).slice(0, 7);
    setReport(null);
    router.push(`/reports/monthly?month=${nextMonth}`);
  };
  const theme = report.focusTheme
    ? categoryMap.get(report.focusTheme.statusKey)
    : null;
  const maxCategoryXp = Math.max(
    1,
    ...report.categoryXp.map((category) => Math.max(0, category.earnedXp))
  );

  return (
    <>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          className="button-secondary min-h-0 px-4 py-2 text-sm"
          type="button"
          onClick={() => moveMonth(-1)}
        >
          ← 前月
        </button>
        <p className="text-center text-sm font-bold text-[#667269]">
          {monthLabel(report.month)}
        </p>
        <button
          className="button-secondary min-h-0 px-4 py-2 text-sm"
          type="button"
          onClick={() => moveMonth(1)}
        >
          次月 →
        </button>
      </div>

      <section className="card my-5 overflow-hidden">
        <div className="bg-[#173f35] p-5 text-white">
          <p className="text-xs font-black tracking-widest text-[#d9bd84]">
            LUCIEN&apos;S MONTHLY REVIEW
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
            <span className="text-[10px] font-bold text-[#667269]">
              獲得XP
            </span>
          </div>
          <div className="bg-white/80 p-4 text-center">
            <strong className="block text-2xl">
              {report.totals.completionRate}%
            </strong>
            <span className="text-[10px] font-bold text-[#667269]">
              達成率
            </span>
          </div>
        </div>
      </section>

      <section className="card mb-5 overflow-hidden">
        <div className="bg-[#f1ecdf] p-5">
          <p className="eyebrow">Monthly title</p>
          <p className="mt-2 text-xs font-black tracking-[0.16em] text-[#bd8d39]">
            {report.title.name}
          </p>
          <h2 className="serif mt-1 text-2xl font-semibold">
            {report.title.label}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#667269]">
            {report.title.description}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-px bg-[#173f3515]">
          <div className="bg-white/80 p-4 text-center">
            <strong className="block text-xl">
              {report.totals.activeDays}
            </strong>
            <span className="text-[10px] font-bold text-[#667269]">
              記録日
            </span>
          </div>
          <div className="bg-white/80 p-4 text-center">
            <strong className="block text-xl">
              {report.totals.dailyClearDays}
            </strong>
            <span className="text-[10px] font-bold text-[#667269]">
              Daily Clear
            </span>
          </div>
          <div className="bg-white/80 p-4 text-center">
            <strong className="block text-xl">
              {report.totals.perfectDays}
            </strong>
            <span className="text-[10px] font-bold text-[#667269]">
              Perfect
            </span>
          </div>
        </div>
      </section>

      <section className="card mb-5 p-5">
        <p className="eyebrow">Monthly calendar</p>
        <h2 className="serif text-xl font-semibold">一か月の足跡</h2>
        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {weekdayLabels.map((label) => (
            <span
              className="pb-1 text-center text-[10px] font-black text-[#667269]"
              key={label}
            >
              {label}
            </span>
          ))}
          {Array.from({ length: report.firstWeekday }, (_, index) => (
            <span aria-hidden="true" key={`blank-${index}`} />
          ))}
          {report.days.map((day) => {
            const dayNumber = Number(day.gameDate.slice(8, 10));
            return (
              <div
                className={`flex aspect-square flex-col items-center justify-center rounded-xl border text-center ${
                  day.isPerfect
                    ? "border-[#bd8d39] bg-[#fff2cf]"
                    : day.isDailyClear
                      ? "border-[#2f6556] bg-[#e5f0e8]"
                      : day.completedMissions > 0
                        ? "border-[#d7c8aa] bg-[#f6f0e4]"
                        : "border-transparent bg-[#f3efe7]"
                }`}
                key={day.gameDate}
                title={`${day.completedMissions}/${day.totalMissions}`}
              >
                <span className="text-[10px] font-black">{dayNumber}</span>
                <span className="text-[9px] text-[#667269]">
                  {day.isPerfect
                    ? "★"
                    : day.completedMissions > 0
                      ? day.completedMissions
                      : "·"}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs leading-5 text-[#667269]">
          ★ Perfect　緑 Daily Clear　薄茶 一歩を記録
        </p>
      </section>

      <section className="card mb-5 p-5">
        <p className="eyebrow">Focus theme</p>
        <h2 className="serif text-xl font-semibold">今月の重点テーマ</h2>
        {report.focusTheme ? (
          <>
            <div className="mt-4 rounded-2xl bg-[#173f35] p-5 text-white">
              <p className="text-3xl">{theme?.icon ?? "✦"}</p>
              <p className="mt-2 text-xs font-black tracking-widest text-[#d9bd84]">
                {theme?.statusName ?? report.focusTheme.statusKey} MONTH
              </p>
              <strong className="serif mt-1 block text-2xl">
                {theme?.name ?? report.focusTheme.statusKey}月間
              </strong>
              <p className="mt-3 text-sm text-white/75">
                今月もっとも育った能力です。+
                {report.focusTheme.earnedXp} XP
              </p>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#667269]">
              現在は振り返り表示のみです。XP倍率は変更しません。
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm leading-6 text-[#667269]">
            今月の一歩が記録されると、重点テーマが現れます。
          </p>
        )}
      </section>

      <section className="card mb-8 p-5">
        <p className="eyebrow">Growth by ability</p>
        <h2 className="serif text-xl font-semibold">能力別XP</h2>
        <div className="mt-4 space-y-4">
          {report.categoryXp.length > 0 ? (
            report.categoryXp.map((status) => {
              const category = categoryMap.get(status.statusKey);
              const width = Math.max(
                status.earnedXp > 0 ? 3 : 0,
                (Math.max(0, status.earnedXp) / maxCategoryXp) * 100
              );
              return (
                <div key={status.statusKey}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-bold">
                      {category?.icon ?? "✦"}{" "}
                      {category?.statusName ?? status.statusKey}
                    </span>
                    <strong className="text-sm text-[#bd8d39]">
                      {status.earnedXp >= 0 ? "+" : ""}
                      {status.earnedXp} XP
                    </strong>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#e8e3d8]">
                    <div
                      className="h-full rounded-full bg-[#173f35]"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-[#667269]">
              この月の能力XPはまだありません。
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
