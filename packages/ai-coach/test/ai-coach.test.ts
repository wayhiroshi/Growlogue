import { describe, expect, it } from "vitest";
import {
  buildFallbackDailyReview,
  extractResponseOutputText,
  isDailyReviewSnapshot,
  isModerationFlagged,
  validateDailyReviewText,
  type DailyReviewSnapshot
} from "../src";

const snapshot: DailyReviewSnapshot = {
  gameDate: "2026-07-30",
  dayMode: "NORMAL",
  coreCompleted: 3,
  totalCompleted: 4,
  totalMissions: 5,
  earnedXp: 40,
  currentStreak: 7,
  dailyClear: true,
  perfect: false
};

describe("AI coach domain", () => {
  it("accepts aggregate-only daily snapshots", () => {
    expect(isDailyReviewSnapshot(snapshot)).toBe(true);
    expect(
      isDailyReviewSnapshot({ ...snapshot, habitTitle: "private", totalMissions: 21 })
    ).toBe(false);
  });

  it("selects a deterministic gentle fallback", () => {
    expect(buildFallbackDailyReview(snapshot)).toEqual({
      source: "fallback",
      summary: "Daily Clear達成です。4件の行動が確かな前進になりました。",
      nextAction: "余力があればBonusを一つ、なければ本日はここで十分です。"
    });
  });

  it("rejects excessive and guilt-inducing output", () => {
    expect(
      validateDailyReviewText({
        summary: "よく進みました。",
        nextAction: "次は小さな一歩を選びましょう。"
      })
    ).not.toBeNull();
    expect(
      validateDailyReviewText({
        summary: "サボらず続けるべきです。",
        nextAction: "次へ。"
      })
    ).toBeNull();
  });

  it("extracts completed response text and moderation status", () => {
    expect(
      extractResponseOutputText({
        status: "completed",
        output: [{ content: [{ type: "output_text", text: "{\"ok\":true}" }] }]
      })
    ).toBe("{\"ok\":true}");
    expect(isModerationFlagged({ results: [{ flagged: false }] })).toBe(false);
    expect(isModerationFlagged({ results: [] })).toBeNull();
  });
});
