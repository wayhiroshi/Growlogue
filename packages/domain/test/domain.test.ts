import { describe, expect, it } from "vitest";
import {
  calculateStreaks,
  evaluateDailyProgress,
  getGameDate,
  getLocalMinute,
  isQuietTime,
  levelFromXp,
  maxNotificationsForLevel,
  nextStreak,
  selectButlerMood,
  selectDailyMissions,
  selectNotificationTrigger
} from "../src/index";

describe("getGameDate", () => {
  it("午前4時までは前日として扱う", () => {
    expect(
      getGameDate(new Date("2026-07-26T18:59:59.000Z"), "Asia/Tokyo", 4)
    ).toBe("2026-07-26");
    expect(
      getGameDate(new Date("2026-07-26T19:00:00.000Z"), "Asia/Tokyo", 4)
    ).toBe("2026-07-27");
  });
});

describe("daily progress", () => {
  it("基本3件でDaily Clear、全5件でPerfectになる", () => {
    expect(
      evaluateDailyProgress([
        { role: "CORE", status: "COMPLETED" },
        { role: "CORE", status: "COMPLETED" },
        { role: "CORE", status: "COMPLETED" },
        { role: "BONUS", status: "PENDING" },
        { role: "BONUS", status: "PENDING" }
      ])
    ).toMatchObject({ isDailyClear: true, isPerfect: false });

    expect(
      evaluateDailyProgress([
        { role: "CORE", status: "COMPLETED" },
        { role: "CORE", status: "COMPLETED" },
        { role: "CORE", status: "COMPLETED" },
        { role: "BONUS", status: "COMPLETED" },
        { role: "BONUS", status: "COMPLETED" }
      ])
    ).toMatchObject({ isDailyClear: true, isPerfect: true });
  });
});

describe("level", () => {
  it("二次曲線でレベルを計算する", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(900)).toBe(4);
  });
});

describe("mission selection", () => {
  it("最大5件、先頭3件を基本ミッションにする", () => {
    const selected = selectDailyMissions(
      Array.from({ length: 6 }, (_, index) => ({
        id: `habit-${index}`,
        categoryKey: `category-${index}`,
        preferredOrder: index,
        isActive: true
      })),
      "2026-07-26"
    );
    expect(selected).toHaveLength(5);
    expect(selected.filter((mission) => mission.role === "CORE")).toHaveLength(3);
  });
});

describe("streak", () => {
  it("連続したDaily Clearを加算し、空白後は1へ戻す", () => {
    expect(
      nextStreak({
        previousGameDate: "2026-07-25",
        previousStreak: 4,
        currentGameDate: "2026-07-26",
        wasDailyClear: true
      })
    ).toBe(5);
    expect(
      nextStreak({
        previousGameDate: "2026-07-23",
        previousStreak: 4,
        currentGameDate: "2026-07-26",
        wasDailyClear: true
      })
    ).toBe(1);
  });

  it("完全休息日を挟んでも連続記録を維持する", () => {
    expect(
      calculateStreaks(
        ["2026-07-25", "2026-07-27", "2026-07-30"],
        new Set(["2026-07-26", "2026-07-28"])
      )
    ).toEqual({
      currentDays: 1,
      longestDays: 2,
      lastClearGameDate: "2026-07-30"
    });
  });
});

describe("butler mood", () => {
  it("達成と不在日数から決定し、休息中は穏やかにする", () => {
    expect(
      selectButlerMood({
        coreCompleted: 3,
        totalCompleted: 5,
        totalMissions: 5,
        inactiveDays: 0
      })
    ).toBe("DELIGHTED");
    expect(
      selectButlerMood({
        coreCompleted: 0,
        totalCompleted: 0,
        totalMissions: 5,
        inactiveDays: 3
      })
    ).toBe("SULKING");
    expect(
      selectButlerMood({
        coreCompleted: 0,
        totalCompleted: 0,
        totalMissions: 5,
        inactiveDays: 7
      })
    ).toBe("WORRIED");
    expect(
      selectButlerMood({
        coreCompleted: 0,
        totalCompleted: 0,
        totalMissions: 5,
        inactiveDays: 7,
        dayMode: "SICK"
      })
    ).toBe("CALM");
  });
});

describe("notification policy", () => {
  it("利用者タイムゾーンの時刻と夜間停止を扱う", () => {
    expect(
      getLocalMinute(new Date("2026-07-27T23:15:00.000Z"), "Asia/Tokyo")
    ).toBe(8 * 60 + 15);
    expect(isQuietTime(23 * 60 + 45, "23:30", "08:00")).toBe(true);
    expect(isQuietTime(8 * 60, "23:30", "08:00")).toBe(false);
  });

  it("積極的は最大5件、休息日は通知しない", () => {
    expect(maxNotificationsForLevel("ACTIVE")).toBe(5);
    expect(
      selectNotificationTrigger({
        localMinute: 18 * 60,
        quietHoursStart: "23:30",
        quietHoursEnd: "08:00",
        notificationLevel: "ACTIVE",
        dayMode: "NORMAL",
        coreCompleted: 0,
        totalCompleted: 0,
        totalMissions: 5,
        inactiveDays: 0
      })
    ).toBe("EVENING");
    expect(
      selectNotificationTrigger({
        localMinute: 18 * 60,
        quietHoursStart: "23:30",
        quietHoursEnd: "08:00",
        notificationLevel: "ACTIVE",
        dayMode: "REST",
        coreCompleted: 0,
        totalCompleted: 0,
        totalMissions: 5,
        inactiveDays: 0
      })
    ).toBeNull();
  });
});
