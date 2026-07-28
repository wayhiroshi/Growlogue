import { describe, expect, it } from "vitest";
import {
  buildWeeklyReport,
  isGameDate,
  startOfIsoWeek
} from "../lib/weekly-report-domain";

describe("weekly report", () => {
  it("starts the ISO week on Monday", () => {
    expect(startOfIsoWeek("2026-07-29")).toBe("2026-07-27");
    expect(startOfIsoWeek("2026-08-02")).toBe("2026-07-27");
    expect(isGameDate("2026-02-30")).toBe(false);
  });

  it("builds seven days and aggregates completion, XP, clear, and perfect", () => {
    const report = buildWeeklyReport({
      weekStart: "2026-07-27",
      missionDays: [
        {
          gameDate: "2026-07-27",
          totalMissions: 5,
          completedMissions: 5,
          coreCompleted: 3
        },
        {
          gameDate: "2026-07-28",
          totalMissions: 5,
          completedMissions: 3,
          coreCompleted: 3
        }
      ],
      xpDays: [
        { gameDate: "2026-07-27", earnedXp: 50 },
        { gameDate: "2026-07-28", earnedXp: 30 }
      ],
      modeDays: [],
      categoryXp: [{ statusKey: "health", earnedXp: 40 }],
      habitCompletions: [{ title: "運動", completedCount: 2 }],
      currentStreak: 2,
      longestStreak: 4
    });

    expect(report.days).toHaveLength(7);
    expect(report.weekEnd).toBe("2026-08-02");
    expect(report.totals).toEqual({
      missions: 10,
      completed: 8,
      earnedXp: 80,
      dailyClearDays: 2,
      perfectDays: 1,
      completionRate: 80
    });
    expect(report.topHabit?.title).toBe("運動");
  });
});
