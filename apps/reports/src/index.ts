import { getGameDate } from "@growlogue/domain";
import {
  buildMonthlyReport,
  endOfGameMonth,
  isMonthKey,
  monthStartFromGameDate,
  type CategoryXpRow,
  type HabitCompletionRow,
  type MissionDayRow,
  type ModeDayRow,
  type XpDayRow
} from "@growlogue/reports";

const INTERNAL_USER_HEADER = "X-Growlogue-User-Id";

interface ProfileRow {
  timezone: string;
  resetHour: number;
}

interface StreakRow {
  currentDays: number;
  longestDays: number;
}

function jsonError(code: string, message: string, status: number): Response {
  return Response.json(
    { error: { code, message } },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}

async function getMonthlyReport(
  env: CloudflareEnv,
  userId: string,
  requestedMonth?: string
) {
  const profile = await env.DB.prepare(
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
  const monthStart = requestedMonth
    ? `${requestedMonth}-01`
    : monthStartFromGameDate(currentGameDate);
  const monthEnd = endOfGameMonth(monthStart);

  const [
    missionResult,
    xpResult,
    modeResult,
    categoryResult,
    habitResult,
    streak
  ] = await Promise.all([
    env.DB.prepare(
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
      .bind(userId, monthStart, monthEnd)
      .all<MissionDayRow>(),
    env.DB.prepare(
      `SELECT "gameDate", SUM("amount") AS "earnedXp"
       FROM "XpLedger"
       WHERE "userId" = ? AND "gameDate" BETWEEN ? AND ?
       GROUP BY "gameDate" ORDER BY "gameDate"`
    )
      .bind(userId, monthStart, monthEnd)
      .all<XpDayRow>(),
    env.DB.prepare(
      `SELECT "gameDate", "mode"
       FROM "DailyMode"
       WHERE "userId" = ? AND "gameDate" BETWEEN ? AND ?`
    )
      .bind(userId, monthStart, monthEnd)
      .all<ModeDayRow>(),
    env.DB.prepare(
      `SELECT "statusKey", SUM("amount") AS "earnedXp"
       FROM "XpLedger"
       WHERE "userId" = ? AND "gameDate" BETWEEN ? AND ?
       GROUP BY "statusKey"
       HAVING SUM("amount") != 0
       ORDER BY SUM("amount") DESC`
    )
      .bind(userId, monthStart, monthEnd)
      .all<CategoryXpRow>(),
    env.DB.prepare(
      `SELECT h."title", COUNT(*) AS "completedCount"
       FROM "DailyMission" m
       JOIN "Habit" h ON h."id" = m."habitId"
       WHERE m."userId" = ? AND m."gameDate" BETWEEN ? AND ?
         AND m."status" = 'COMPLETED'
       GROUP BY h."id", h."title"
       ORDER BY "completedCount" DESC, h."title"
       LIMIT 1`
    )
      .bind(userId, monthStart, monthEnd)
      .all<HabitCompletionRow>(),
    env.DB.prepare(
      `SELECT "currentDays", "longestDays"
       FROM "Streak" WHERE "userId" = ?`
    )
      .bind(userId)
      .first<StreakRow>()
  ]);

  return buildMonthlyReport({
    monthStart,
    missionDays: missionResult.results,
    xpDays: xpResult.results,
    modeDays: modeResult.results,
    categoryXp: categoryResult.results,
    habitCompletions: habitResult.results,
    currentStreak: streak?.currentDays ?? 0,
    longestStreak: streak?.longestDays ?? 0
  });
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "GET" || url.pathname !== "/monthly") {
      return jsonError("NOT_FOUND", "Report APIが見つかりません。", 404);
    }

    const userId = request.headers.get(INTERNAL_USER_HEADER);
    if (!userId || userId.length > 128) {
      return jsonError("UNAUTHORIZED", "内部認証が必要です。", 401);
    }

    const month = url.searchParams.get("month");
    if (month && !isMonthKey(month)) {
      return jsonError(
        "INVALID_MONTH",
        "月はYYYY-MM形式で指定してください。",
        400
      );
    }

    try {
      const report = await getMonthlyReport(
        env,
        userId,
        month ?? undefined
      );
      return Response.json(
        { report },
        {
          headers: {
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff"
          }
        }
      );
    } catch (error) {
      const errorName =
        error instanceof Error ? error.message : "UNKNOWN_ERROR";
      console.error(
        JSON.stringify({
          message: "monthly_report_failed",
          error: errorName
        })
      );
      if (errorName === "PROFILE_NOT_FOUND") {
        return jsonError(
          "PROFILE_NOT_FOUND",
          "プロフィールが見つかりません。",
          404
        );
      }
      return jsonError(
        "INTERNAL_ERROR",
        "月間レポートを生成できませんでした。",
        500
      );
    }
  }
} satisfies ExportedHandler<CloudflareEnv>;
