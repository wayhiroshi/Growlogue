export const DAILY_REVIEW_LIMITS = {
  summary: 120,
  nextAction: 80
} as const;

export interface DailyReviewSnapshot {
  gameDate: string;
  dayMode: "NORMAL" | "HOLIDAY" | "SICK" | "BUSY" | "REST";
  coreCompleted: number;
  totalCompleted: number;
  totalMissions: number;
  earnedXp: number;
  currentStreak: number;
  dailyClear: boolean;
  perfect: boolean;
}

export interface DailyReviewText {
  summary: string;
  nextAction: string;
}

export interface DailyReviewResult extends DailyReviewText {
  source: "ai" | "fallback";
}

const unsafePatterns = [
  /怠け/u,
  /サボ/u,
  /情けな/u,
  /失望/u,
  /罰/u,
  /価値がない/u,
  /絶対に.*(?:しろ|すべき|なさい)/u
];

function isSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

export function isDailyReviewSnapshot(
  value: unknown
): value is DailyReviewSnapshot {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.gameDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/u.test(input.gameDate) &&
    ["NORMAL", "HOLIDAY", "SICK", "BUSY", "REST"].includes(
      String(input.dayMode)
    ) &&
    isSafeInteger(input.coreCompleted) &&
    isSafeInteger(input.totalCompleted) &&
    isSafeInteger(input.totalMissions) &&
    isSafeInteger(input.earnedXp) &&
    isSafeInteger(input.currentStreak) &&
    typeof input.dailyClear === "boolean" &&
    typeof input.perfect === "boolean" &&
    input.coreCompleted <= input.totalCompleted &&
    input.totalCompleted <= input.totalMissions &&
    input.totalMissions <= 20
  );
}

export function buildFallbackDailyReview(
  snapshot: DailyReviewSnapshot
): DailyReviewResult {
  if (snapshot.dayMode === "SICK" || snapshot.dayMode === "REST") {
    return {
      source: "fallback",
      summary: "本日は休むことも立派な選択です。歩みを守れています。",
      nextAction: "回復を最優先にして、次の一歩は元気な日に選びましょう。"
    };
  }
  if (snapshot.perfect) {
    return {
      source: "fallback",
      summary: `全任務完了、見事です。本日は ${snapshot.earnedXp} XP を積み上げました。`,
      nextAction: "今日できたことを一つ覚えて、ゆっくり休みましょう。"
    };
  }
  if (snapshot.dailyClear) {
    return {
      source: "fallback",
      summary: `Daily Clear達成です。${snapshot.totalCompleted}件の行動が確かな前進になりました。`,
      nextAction: "余力があればBonusを一つ、なければ本日はここで十分です。"
    };
  }
  if (snapshot.totalCompleted > 0) {
    return {
      source: "fallback",
      summary: `${snapshot.totalCompleted}件を完了しました。小さな前進は、きちんと物語に残っています。`,
      nextAction: "次は最も小さく始められるCoreを一つ選びましょう。"
    };
  }
  return {
    source: "fallback",
    summary: "まだ何も決まっていない時間にも、次の一歩を選ぶ余地があります。",
    nextAction: "今日は一番軽いCoreを、始めるだけで十分です。"
  };
}

export function validateDailyReviewText(
  value: unknown
): DailyReviewText | null {
  if (!value || typeof value !== "object") return null;
  const output = value as Record<string, unknown>;
  if (
    typeof output.summary !== "string" ||
    typeof output.nextAction !== "string"
  ) {
    return null;
  }
  const summary = output.summary.trim();
  const nextAction = output.nextAction.trim();
  if (
    summary.length === 0 ||
    nextAction.length === 0 ||
    summary.length > DAILY_REVIEW_LIMITS.summary ||
    nextAction.length > DAILY_REVIEW_LIMITS.nextAction
  ) {
    return null;
  }
  const combined = `${summary}\n${nextAction}`;
  if (unsafePatterns.some((pattern) => pattern.test(combined))) return null;
  return { summary, nextAction };
}

export function extractResponseOutputText(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const response = value as Record<string, unknown>;
  if (response.status !== "completed" || !Array.isArray(response.output)) {
    return null;
  }
  for (const item of response.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const record = part as Record<string, unknown>;
      if (record.type === "output_text" && typeof record.text === "string") {
        return record.text;
      }
    }
  }
  return null;
}

export function isModerationFlagged(value: unknown): boolean | null {
  if (!value || typeof value !== "object") return null;
  const results = (value as Record<string, unknown>).results;
  if (!Array.isArray(results) || results.length === 0) return null;
  const first = results[0];
  if (!first || typeof first !== "object") return null;
  const flagged = (first as Record<string, unknown>).flagged;
  return typeof flagged === "boolean" ? flagged : null;
}
