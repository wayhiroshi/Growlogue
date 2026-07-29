import { categories } from "@growlogue/content";
import type { WeeklyReportView } from "./weekly-report-domain";

export interface ShareCardOptions {
  includeCategoryXp: boolean;
  includeStreak: boolean;
}

export interface ShareCardSnapshot {
  version: 1;
  weekStart: string;
  weekEnd: string;
  headline: string;
  lucienComment: string;
  totals: WeeklyReportView["totals"];
  days: Array<{
    gameDate: string;
    completedMissions: number;
    totalMissions: number;
    isDailyClear: boolean;
    isPerfect: boolean;
  }>;
  categoryXp: Array<{
    statusKey: string;
    label: string;
    icon: string;
    earnedXp: number;
  }> | null;
  streak: {
    currentDays: number;
    longestDays: number;
  } | null;
}

const categoryMap = new Map<string, (typeof categories)[number]>(
  categories.map((category) => [category.key, category])
);

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function shortDate(value: string): string {
  const [, month, day] = value.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function buildShareCardSnapshot(
  report: WeeklyReportView,
  options: ShareCardOptions
): ShareCardSnapshot {
  return {
    version: 1,
    weekStart: report.weekStart,
    weekEnd: report.weekEnd,
    headline: report.headline,
    lucienComment: report.lucienComment,
    totals: report.totals,
    days: report.days.map((day) => ({
      gameDate: day.gameDate,
      completedMissions: day.completedMissions,
      totalMissions: day.totalMissions,
      isDailyClear: day.isDailyClear,
      isPerfect: day.isPerfect
    })),
    categoryXp: options.includeCategoryXp
      ? report.categoryXp.map((status) => {
          const category = categoryMap.get(status.statusKey);
          return {
            statusKey: status.statusKey,
            label: category?.statusName ?? status.statusKey,
            icon: category?.icon ?? "✦",
            earnedXp: status.earnedXp
          };
        })
      : null,
    streak: options.includeStreak ? report.streak : null
  };
}

export function renderShareCardHtml(snapshot: ShareCardSnapshot): string {
  const weekdays = ["月", "火", "水", "木", "金", "土", "日"];
  const dayBars = snapshot.days
    .map((day, index) => {
      const percent =
        day.totalMissions === 0
          ? 0
          : Math.round(
              (day.completedMissions / day.totalMissions) * 100
            );
      const height = Math.max(percent > 0 ? 10 : 0, percent);
      const color = day.isPerfect ? "#c79542" : "#2f6556";
      return `<div class="day">
        <span>${weekdays[index]}</span>
        <div class="bar"><i style="height:${height}%;background:${color}"></i></div>
        <b>${day.isPerfect ? "★" : day.completedMissions}</b>
      </div>`;
    })
    .join("");
  const categoryRows =
    snapshot.categoryXp && snapshot.categoryXp.length > 0
      ? `<div class="growth">${snapshot.categoryXp
          .slice(0, 5)
          .map(
            (category) =>
              `<span>${escapeHtml(category.icon)} ${escapeHtml(
                category.label
              )} <b>${category.earnedXp >= 0 ? "+" : ""}${
                category.earnedXp
              } XP</b></span>`
          )
          .join("")}</div>`
      : "";
  const streak = snapshot.streak
    ? `<div class="streak"><small>STREAK</small><strong>${snapshot.streak.currentDays}日</strong></div>`
    : "";

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<style>
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP","Hiragino Sans",sans-serif;background:#eee7d9;color:#173f35}
#share-card{width:1200px;height:630px;padding:48px 56px;background:radial-gradient(circle at 92% 5%,#fff7df 0,transparent 34%),linear-gradient(145deg,#f8f4ea,#e6dcc7);position:relative}
.brand{font-size:19px;font-weight:900;letter-spacing:.16em;color:#a2752f}.date{position:absolute;right:56px;top:52px;font-weight:800;color:#647268}
h1{font-family:Georgia,"Yu Mincho",serif;font-size:48px;line-height:1.18;margin:24px 0 10px;max-width:920px}.comment{font-size:20px;line-height:1.6;color:#52645b;margin:0;max-width:930px}
.metrics{display:flex;gap:14px;margin-top:28px}.metric{width:176px;background:#fffaf0;border:1px solid #d7c8aa;border-radius:20px;padding:15px 20px}.metric b{display:block;font-size:34px;line-height:1}.metric span{font-size:13px;font-weight:800;color:#6e786f}
.week{position:absolute;left:56px;bottom:46px;display:flex;gap:10px}.day{text-align:center;width:42px;font-size:12px;font-weight:800}.bar{height:100px;border-radius:12px;background:#d8d0c1;overflow:hidden;display:flex;align-items:flex-end;margin:6px 0}.bar i{display:block;width:100%;border-radius:12px}.day b{font-size:13px}
.growth{position:absolute;left:470px;right:56px;bottom:56px;display:flex;flex-wrap:wrap;gap:10px}.growth span{background:#173f35;color:#fff;border-radius:999px;padding:10px 14px;font-size:14px;font-weight:700}.growth b{color:#e4c077;margin-left:6px}
.streak{position:absolute;right:56px;top:270px;text-align:right}.streak small{display:block;font-weight:900;letter-spacing:.16em;color:#a2752f}.streak strong{font-family:Georgia,serif;font-size:36px}
.seal{position:absolute;right:42px;bottom:30px;width:62px;height:62px;border:2px solid #a2752f;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-weight:bold;color:#a2752f;opacity:.45}
</style>
</head>
<body>
<main id="share-card">
  <div class="brand">GROWLOGUE · WEEKLY CHRONICLE</div>
  <div class="date">${shortDate(snapshot.weekStart)} — ${shortDate(
    snapshot.weekEnd
  )}</div>
  <h1>${escapeHtml(snapshot.headline)}</h1>
  <p class="comment">${escapeHtml(snapshot.lucienComment)}</p>
  <section class="metrics">
    <div class="metric"><b>${snapshot.totals.completed}</b><span>MISSIONS</span></div>
    <div class="metric"><b>${snapshot.totals.earnedXp}</b><span>XP EARNED</span></div>
    <div class="metric"><b>${snapshot.totals.completionRate}%</b><span>COMPLETION</span></div>
    <div class="metric"><b>${snapshot.totals.dailyClearDays}</b><span>DAILY CLEAR</span></div>
    <div class="metric"><b>${snapshot.totals.perfectDays}</b><span>PERFECT</span></div>
  </section>
  <section class="week">${dayBars}</section>
  ${categoryRows}
  ${streak}
  <div class="seal">G</div>
</main>
</body>
</html>`;
}

export function renderPublicSharePage(
  snapshot: ShareCardSnapshot,
  imageUrl: string,
  expiresAt: string
): string {
  const title = `${snapshot.headline} | Growlogue`;
  const escapedImageUrl = escapeHtml(imageUrl);
  const growlogueUrl = escapeHtml(new URL(imageUrl).origin);
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="Growlogue 一週間の成長記録">
<meta property="og:image" content="${escapedImageUrl}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:image" content="${escapedImageUrl}">
<title>${escapeHtml(title)}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#eee7d9;color:#173f35;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif}
main{max-width:900px;margin:0 auto;padding:28px 18px 48px}.brand{font-weight:900;letter-spacing:.14em;color:#a2752f}
h1{font-family:Georgia,"Yu Mincho",serif;font-size:30px;margin:12px 0 20px}img{display:block;width:100%;height:auto;border-radius:20px;box-shadow:0 16px 45px #173f3530}
p{font-size:13px;color:#667269;text-align:center;margin-top:18px}a{color:#173f35;font-weight:800}
</style>
</head>
<body>
<main>
  <div class="brand">GROWLOGUE · WEEKLY CHRONICLE</div>
  <h1>${escapeHtml(snapshot.headline)}</h1>
  <img src="${escapedImageUrl}" alt="Growlogueの週間共有カード" width="1200" height="630">
  <p>この共有は ${escapeHtml(
    new Date(expiresAt).toLocaleDateString("ja-JP")
  )} まで有効です。 · <a href="${growlogueUrl}/">Growlogue</a></p>
</main>
</body>
</html>`;
}

export function isShareCardSnapshot(
  value: unknown
): value is ShareCardSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ShareCardSnapshot>;
  return (
    snapshot.version === 1 &&
    typeof snapshot.weekStart === "string" &&
    typeof snapshot.weekEnd === "string" &&
    typeof snapshot.headline === "string" &&
    typeof snapshot.lucienComment === "string" &&
    !!snapshot.totals &&
    Array.isArray(snapshot.days)
  );
}
