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

interface WeeklyShare {
  id: string;
  expiresAt: string;
  url: string | null;
  imageUrl: string | null;
  note?: string;
}

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
  const [share, setShare] = useState<WeeklyShare | null>(null);
  const [shareError, setShareError] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [includeCategoryXp, setIncludeCategoryXp] = useState(true);
  const [includeStreak, setIncludeStreak] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<1 | 7 | 30>(7);
  const [creatingShare, setCreatingShare] = useState(false);

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
      try {
        const shareResponse = await fetch(
          `/api/v1/share-cards?weekStart=${encodeURIComponent(
            body.report.weekStart
          )}`,
          { signal: controller.signal }
        );
        if (shareResponse.ok) {
          const shareBody = (await shareResponse.json()) as {
            share: WeeklyShare | null;
          };
          setShare(shareBody.share);
        } else {
          setShareError("共有状態を読み込めませんでした。");
        }
      } catch (shareLoadError: unknown) {
        if (
          shareLoadError instanceof DOMException &&
          shareLoadError.name === "AbortError"
        ) {
          throw shareLoadError;
        }
        setShareError("共有状態を読み込めませんでした。");
      }
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
    setShare(null);
    setShareError("");
    setShareMessage("");
    router.push(`/reports/weekly?week=${weekStart}`);
  };

  const createShare = async () => {
    setCreatingShare(true);
    setShareError("");
    setShareMessage("");
    try {
      const response = await fetch("/api/v1/share-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: report.weekStart,
          expiresInDays,
          includeCategoryXp,
          includeStreak
        })
      });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setShareError(
          body?.error?.message ??
            "共有カードを生成できませんでした。"
        );
        return;
      }
      const body = (await response.json()) as { share: WeeklyShare };
      setShare(body.share);
      setShareMessage("共有カードを作成しました。");
    } catch {
      setShareError("共有カードを生成できませんでした。");
    } finally {
      setCreatingShare(false);
    }
  };

  const shareCard = async () => {
    if (!share?.url) return;
    setShareError("");
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Growlogue 週間レポート",
          text: "一週間の成長記録です。",
          url: share.url
        });
      } catch (shareFailure: unknown) {
        if (
          shareFailure instanceof DOMException &&
          shareFailure.name === "AbortError"
        ) {
          return;
        }
        setShareError("共有メニューを開けませんでした。");
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(share.url);
      setShareMessage("共有URLをコピーしました。");
    } catch {
      setShareError("共有URLをコピーできませんでした。");
    }
  };

  const revokeShare = async () => {
    if (
      !share ||
      !window.confirm("この共有リンクを無効にしますか？")
    ) {
      return;
    }
    setShareError("");
    try {
      const response = await fetch(
        `/api/v1/share-cards/${encodeURIComponent(share.id)}/revoke`,
        { method: "POST" }
      );
      if (!response.ok) {
        setShareError("共有リンクを無効にできませんでした。");
        return;
      }
      setShare(null);
      setShareMessage("共有リンクを無効にしました。");
    } catch {
      setShareError("共有リンクを無効にできませんでした。");
    }
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

      <section className="card mb-8 overflow-hidden">
        <div className="bg-[#173f35] p-5 text-white">
          <p className="text-xs font-black tracking-widest text-[#d9bd84]">
            SHARE YOUR CHRONICLE
          </p>
          <h2 className="serif mt-2 text-2xl font-semibold">
            週間カードを共有する
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/75">
            Habit名、Wish、収入・体重・金額などの非公開情報は含まれません。
          </p>
        </div>
        <div className="space-y-4 p-5">
          <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl bg-[#f1ecdf] px-4 py-3 font-bold">
            能力XPを含める
            <input
              checked={includeCategoryXp}
              className="h-5 w-5 accent-[#173f35]"
              type="checkbox"
              onChange={(event) =>
                setIncludeCategoryXp(event.target.checked)
              }
            />
          </label>
          <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl bg-[#f1ecdf] px-4 py-3 font-bold">
            連続記録を含める
            <input
              checked={includeStreak}
              className="h-5 w-5 accent-[#173f35]"
              type="checkbox"
              onChange={(event) => setIncludeStreak(event.target.checked)}
            />
          </label>
          <label className="block text-sm font-bold">
            有効期間
            <select
              className="mt-2 min-h-12 w-full rounded-xl border border-[#d7c8aa] bg-white px-4"
              value={expiresInDays}
              onChange={(event) =>
                setExpiresInDays(
                  Number(event.target.value) as 1 | 7 | 30
                )
              }
            >
              <option value={1}>1日</option>
              <option value={7}>7日</option>
              <option value={30}>30日</option>
            </select>
          </label>

          {share?.imageUrl ? (
            // The private, expiring image is intentionally served without
            // Next Image optimization so its bearer URL is not cached.
            <img
              alt="生成した週間共有カード"
              className="w-full rounded-xl border border-[#d7c8aa]"
              height={630}
              src={share.imageUrl}
              width={1200}
            />
          ) : null}
          {share?.note ? (
            <p className="rounded-xl bg-[#fff6df] p-3 text-xs leading-5 text-[#6c5a32]">
              {share.note}
            </p>
          ) : null}
          {shareError ? (
            <p className="text-sm font-bold text-[#9f3e35]">{shareError}</p>
          ) : null}
          {shareMessage ? (
            <p className="text-sm font-bold text-[#2f6556]">
              {shareMessage}
            </p>
          ) : null}

          {share?.url ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                className="button-primary"
                type="button"
                onClick={() => void shareCard()}
              >
                共有する
              </button>
              <a
                className="button-secondary text-center"
                href={share.url}
                rel="noreferrer"
                target="_blank"
              >
                表示確認
              </a>
            </div>
          ) : (
            <button
              className="button-primary w-full"
              disabled={creatingShare}
              type="button"
              onClick={() => void createShare()}
            >
              {creatingShare ? "カードを生成中…" : "共有カードを作る"}
            </button>
          )}
          {share ? (
            <button
              className="w-full py-2 text-sm font-bold text-[#9f3e35]"
              type="button"
              onClick={() => void revokeShare()}
            >
              この共有リンクを無効にする
            </button>
          ) : null}
        </div>
      </section>
    </>
  );
}
