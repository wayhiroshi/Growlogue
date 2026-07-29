import { describe, expect, it } from "vitest";
import {
  addGameMonths,
  buildMonthlyReport,
  endOfGameMonth,
  isMonthKey
} from "../lib/monthly-report-domain";

describe("monthly report", () => {
  it("validates and moves calendar months", () => {
    expect(isMonthKey("2026-07")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(addGameMonths("2026-01-01", -1)).toBe("2025-12-01");
    expect(endOfGameMonth("2028-02-01")).toBe("2028-02-29");
  });

  it("aggregates the month and selects its title and focus theme", () => {
    const report = buildMonthlyReport({
      monthStart: "2026-07-01",
      missionDays: Array.from({ length: 8 }, (_, index) => ({
        gameDate: `2026-07-${String(index + 1).padStart(2, "0")}`,
        totalMissions: 5,
        completedMissions: 5,
        coreCompleted: 3
      })),
      xpDays: [{ gameDate: "2026-07-01", earnedXp: 50 }],
      modeDays: [],
      categoryXp: [
        { statusKey: "health", earnedXp: 10 },
        { statusKey: "writing", earnedXp: 40 }
      ],
      habitCompletions: [{ title: "執筆", completedCount: 8 }],
      currentStreak: 8,
      longestStreak: 12
    });

    expect(report.days).toHaveLength(31);
    expect(report.monthEnd).toBe("2026-07-31");
    expect(report.totals).toEqual({
      missions: 40,
      completed: 40,
      earnedXp: 50,
      activeDays: 8,
      dailyClearDays: 8,
      perfectDays: 8,
      completionRate: 100
    });
    expect(report.title.key).toBe("GOLDEN_GENTLEMAN");
    expect(report.focusTheme?.statusKey).toBe("writing");
  });

  it("keeps an empty month gentle", () => {
    const report = buildMonthlyReport({
      monthStart: "2026-02-01",
      missionDays: [],
      xpDays: [],
      modeDays: [],
      categoryXp: [],
      habitCompletions: [],
      currentStreak: 0,
      longestStreak: 0
    });

    expect(report.days).toHaveLength(28);
    expect(report.title.key).toBe("QUIET_CHRONICLE");
    expect(report.focusTheme).toBeNull();
    expect(report.lucienComment).toContain("休息");
  });
});
