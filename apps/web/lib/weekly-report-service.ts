import { getGameDate } from "@growlogue/domain";
import { getRuntime } from "./runtime";
import {
  buildWeeklyReport,
  startOfIsoWeek,
  type CategoryXpRow,
  type HabitCompletionRow,
  type MissionDayRow,
  type ModeDayRow,
  type XpDayRow
} from "./weekly-report-domain";

interface ProfileRow {
  timezone: string;
  resetHour: number;
}

interface StreakRow {
  currentDays: number;
  longestDays: number;
}

export async function getWeeklyReport(
  userId: string,
  requestedWeekStart?: string
) {
  const { db } = getRuntime();
  const profile = await db
    .prepare(
      `SELECT "timezone", "resetHour" FROM "Profile" WHERE "userId" = ?`
    )
    .bind(userId)
    .first<ProfileRow>();
  if (!profile) throw new Error("PROFILE_NOT_FOUND");

  const currentGameDate = getGameDate(
    new Date(),
    profile.timezone,
    profile.resetHour
  );
  const weekStart =
    requestedWeekStart ?? startOfIsoWeek(currentGameDate);
  const weekEnd = new Date(`${weekStart}T00:00:00.000Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const weekEndValue = weekEnd.toISOString().slice(0, 10);

  const [
    missionResult,
    xpResult,
    modeResult,
    categoryResult,
    habitResult,
    streak
  ] = await Promise.all([
    db
      .prepare(
        `SELECT
           "gameDate",
           COUNT(*) AS "totalMissions",
           SUM(CASE WHEN "status" = 'COMPLETED' THEN 1 ELSE 0 END)
             AS "completedMissions",
           SUM(CASE WHEN "role" = 'CORE' AND "status" = 'COMPLETED'
                    THEN 1 ELSE 0 END) AS "coreCompleted"
         FROM "DailyMission"
         WHERE "userId" = ? AND "gameDate" BETWEEN ? AND ?
         GROUP BY "gameDate" ORDER BY "gameDate"`
      )
      .bind(userId, weekStart, weekEndValue)
      .all<MissionDayRow>(),
    db
      .prepare(
        `SELECT "gameDate", SUM("amount") AS "earnedXp"
         FROM "XpLedger"
         WHERE "userId" = ? AND "gameDate" BETWEEN ? AND ?
         GROUP BY "gameDate" ORDER BY "gameDate"`
      )
      .bind(userId, weekStart, weekEndValue)
      .all<XpDayRow>(),
    db
      .prepare(
        `SELECT "gameDate", "mode"
         FROM "DailyMode"
         WHERE "userId" = ? AND "gameDate" BETWEEN ? AND ?`
      )
      .bind(userId, weekStart, weekEndValue)
      .all<ModeDayRow>(),
    db
      .prepare(
        `SELECT "statusKey", SUM("amount") AS "earnedXp"
         FROM "XpLedger"
         WHERE "userId" = ? AND "gameDate" BETWEEN ? AND ?
         GROUP BY "statusKey"
         HAVING SUM("amount") != 0
         ORDER BY ABS(SUM("amount")) DESC`
      )
      .bind(userId, weekStart, weekEndValue)
      .all<CategoryXpRow>(),
    db
      .prepare(
        `SELECT h."title", COUNT(*) AS "completedCount"
         FROM "DailyMission" m
         JOIN "Habit" h ON h."id" = m."habitId"
         WHERE m."userId" = ? AND m."gameDate" BETWEEN ? AND ?
           AND m."status" = 'COMPLETED'
         GROUP BY h."id", h."title"
         ORDER BY "completedCount" DESC, h."title"
         LIMIT 1`
      )
      .bind(userId, weekStart, weekEndValue)
      .all<HabitCompletionRow>(),
    db
      .prepare(
        `SELECT "currentDays", "longestDays"
         FROM "Streak" WHERE "userId" = ?`
      )
      .bind(userId)
      .first<StreakRow>()
  ]);

  return buildWeeklyReport({
    weekStart,
    missionDays: missionResult.results,
    xpDays: xpResult.results,
    modeDays: modeResult.results,
    categoryXp: categoryResult.results,
    habitCompletions: habitResult.results,
    currentStreak: streak?.currentDays ?? 0,
    longestStreak: streak?.longestDays ?? 0
  });
}
