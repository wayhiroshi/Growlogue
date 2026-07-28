export interface MissionDayRow {
  gameDate: string;
  totalMissions: number;
  completedMissions: number;
  coreCompleted: number;
}

export interface XpDayRow {
  gameDate: string;
  earnedXp: number;
}

export interface ModeDayRow {
  gameDate: string;
  mode: string;
}

export interface CategoryXpRow {
  statusKey: string;
  earnedXp: number;
}

export interface HabitCompletionRow {
  title: string;
  completedCount: number;
}

export interface WeeklyReportInput {
  weekStart: string;
  missionDays: MissionDayRow[];
  xpDays: XpDayRow[];
  modeDays: ModeDayRow[];
  categoryXp: CategoryXpRow[];
  habitCompletions: HabitCompletionRow[];
  currentStreak: number;
  longestStreak: number;
}

function parseGameDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function addGameDays(gameDate: string, days: number): string {
  const date = parseGameDate(gameDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function startOfIsoWeek(gameDate: string): string {
  const date = parseGameDate(gameDate);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addGameDays(gameDate, offset);
}

export function isGameDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    parseGameDate(value).toISOString().slice(0, 10) === value
  );
}

export function buildWeeklyReport(input: WeeklyReportInput) {
  const missionByDate = new Map(
    input.missionDays.map((row) => [row.gameDate, row])
  );
  const xpByDate = new Map(
    input.xpDays.map((row) => [row.gameDate, row.earnedXp])
  );
  const modeByDate = new Map(
    input.modeDays.map((row) => [row.gameDate, row.mode])
  );
  const days = Array.from({ length: 7 }, (_, index) => {
    const gameDate = addGameDays(input.weekStart, index);
    const mission = missionByDate.get(gameDate);
    const totalMissions = mission?.totalMissions ?? 0;
    const completedMissions = mission?.completedMissions ?? 0;
    const coreCompleted = mission?.coreCompleted ?? 0;
    return {
      gameDate,
      totalMissions,
      completedMissions,
      coreCompleted,
      earnedXp: xpByDate.get(gameDate) ?? 0,
      dayMode: modeByDate.get(gameDate) ?? "NORMAL",
      isDailyClear: coreCompleted >= 3,
      isPerfect:
        totalMissions > 0 && completedMissions === totalMissions
    };
  });

  const totals = {
    missions: days.reduce((sum, day) => sum + day.totalMissions, 0),
    completed: days.reduce((sum, day) => sum + day.completedMissions, 0),
    earnedXp: days.reduce((sum, day) => sum + day.earnedXp, 0),
    dailyClearDays: days.filter((day) => day.isDailyClear).length,
    perfectDays: days.filter((day) => day.isPerfect).length
  };
  const completionRate =
    totals.missions === 0
      ? 0
      : Math.round((totals.completed / totals.missions) * 100);
  const headline =
    totals.perfectDays > 0
      ? "完璧な一日を積み重ねました"
      : totals.dailyClearDays > 0
        ? "今週も着実に歩みを進めました"
        : totals.completed > 0
          ? "小さな一歩が記録されています"
          : "次の一歩を迎える準備の週です";
  const lucienComment =
    totals.completed === 0
      ? "休む週も物語の一部でございます。次の一歩を小さく始めましょう。"
      : completionRate >= 80
        ? "実に見事な一週間でございました。この歩みを誇りに思います。"
        : completionRate >= 50
          ? "半ばを越えました。無理なく続けたことが何よりの成果です。"
          : "記録された一歩は、確かに次の景色へつながっております。";

  return {
    weekStart: input.weekStart,
    weekEnd: addGameDays(input.weekStart, 6),
    days,
    totals: { ...totals, completionRate },
    categoryXp: input.categoryXp,
    topHabit: input.habitCompletions[0] ?? null,
    streak: {
      currentDays: input.currentStreak,
      longestDays: input.longestStreak
    },
    headline,
    lucienComment
  };
}

export type WeeklyReportView = ReturnType<typeof buildWeeklyReport>;
