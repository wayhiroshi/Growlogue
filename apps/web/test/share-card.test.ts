import { describe, expect, it } from "vitest";
import {
  buildShareCardSnapshot,
  isShareCardSnapshot,
  renderPublicSharePage,
  renderShareCardHtml
} from "../lib/share-card-domain";
import { buildWeeklyReport } from "../lib/weekly-report-domain";

function weeklyReport() {
  return buildWeeklyReport({
    weekStart: "2026-07-27",
    missionDays: [
      {
        gameDate: "2026-07-27",
        totalMissions: 5,
        completedMissions: 5,
        coreCompleted: 3
      }
    ],
    xpDays: [{ gameDate: "2026-07-27", earnedXp: 45 }],
    modeDays: [],
    categoryXp: [{ statusKey: "health", earnedXp: 15 }],
    habitCompletions: [
      { title: "共有してはいけないHabit名", completedCount: 1 }
    ],
    currentStreak: 3,
    longestStreak: 8
  });
}

describe("weekly share card", () => {
  it("stores only explicitly shareable fields", () => {
    const snapshot = buildShareCardSnapshot(weeklyReport(), {
      includeCategoryXp: false,
      includeStreak: false
    });

    expect(snapshot.categoryXp).toBeNull();
    expect(snapshot.streak).toBeNull();
    expect(JSON.stringify(snapshot)).not.toContain(
      "共有してはいけないHabit名"
    );
    expect(isShareCardSnapshot(snapshot)).toBe(true);
  });

  it("includes selected category XP and streak", () => {
    const snapshot = buildShareCardSnapshot(weeklyReport(), {
      includeCategoryXp: true,
      includeStreak: true
    });

    expect(snapshot.categoryXp?.[0]).toMatchObject({
      statusKey: "health",
      earnedXp: 15
    });
    expect(snapshot.streak).toEqual({ currentDays: 3, longestDays: 8 });
  });

  it("escapes content in generated card and public page HTML", () => {
    const snapshot = {
      ...buildShareCardSnapshot(weeklyReport(), {
        includeCategoryXp: false,
        includeStreak: false
      }),
      headline: "<script>alert(1)</script>",
      lucienComment: "\"安全\" & 継続"
    };

    const card = renderShareCardHtml(snapshot);
    const page = renderPublicSharePage(
      snapshot,
      "https://example.com/share/token/image",
      "2026-08-05T00:00:00.000Z"
    );

    expect(card).not.toContain("<script>alert(1)</script>");
    expect(card).toContain("&lt;script&gt;");
    expect(card).toContain("&quot;安全&quot; &amp; 継続");
    expect(page).not.toContain("<script>alert(1)</script>");
    expect(page).toContain("noindex,nofollow");
  });
});
