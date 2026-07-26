import { describe, expect, it } from "vitest";
import {
  evaluateDailyProgress,
  getGameDate,
  levelFromXp,
  nextStreak,
  selectDailyMissions
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
});
