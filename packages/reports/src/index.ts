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

export interface MonthlyReportInput {
  monthStart: string;
  missionDays: MissionDayRow[];
  xpDays: XpDayRow[];
  modeDays: ModeDayRow[];
  categoryXp: CategoryXpRow[];
  habitCompletions: HabitCompletionRow[];
  currentStreak: number;
  longestStreak: number;
}

export interface MonthlyTitle {
  key:
    | "GOLDEN_GENTLEMAN"
    | "STEADY_GENTLEMAN"
    | "PERSISTENT_GENTLEMAN"
    | "FIRST_FOOTSTEPS"
    | "QUIET_CHRONICLE";
  name: string;
  label: string;
  description: string;
}

function parseGameDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function isMonthKey(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}-01T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 7) === value;
}

export function monthStartFromGameDate(gameDate: string): string {
  return `${gameDate.slice(0, 7)}-01`;
}

export function addGameMonths(monthStart: string, months: number): string {
  const date = parseGameDate(monthStart);
  date.setUTCMonth(date.getUTCMonth() + months, 1);
  return date.toISOString().slice(0, 10);
}

export function endOfGameMonth(monthStart: string): string {
  const date = parseGameDate(monthStart);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return date.toISOString().slice(0, 10);
}

function daysInGameMonth(monthStart: string): number {
  return Number(endOfGameMonth(monthStart).slice(8, 10));
}

function selectMonthlyTitle(
  completed: number,
  dailyClearDays: number,
  perfectDays: number
): MonthlyTitle {
  if (perfectDays >= 8) {
    return {
      key: "GOLDEN_GENTLEMAN",
      name: "Golden Gentleman",
      label: "黄金の紳士",
      description: "Perfectを幾度も重ねた、輝かしい一か月です。"
    };
  }
  if (dailyClearDays >= 20) {
    return {
      key: "STEADY_GENTLEMAN",
      name: "Steady Gentleman",
      label: "揺るがぬ紳士",
      description: "日々の基本を丁寧に守り抜いた一か月です。"
    };
  }
  if (completed >= 20) {
    return {
      key: "PERSISTENT_GENTLEMAN",
      name: "Persistent Gentleman",
      label: "歩み続ける紳士",
      description: "小さな前進を幾度も記録した一か月です。"
    };
  }
  if (completed > 0) {
    return {
      key: "FIRST_FOOTSTEPS",
      name: "First Footsteps",
      label: "はじまりの足跡",
      description: "次の章へつながる一歩が記録されました。"
    };
  }
  return {
    key: "QUIET_CHRONICLE",
    name: "Quiet Chronicle",
    label: "静かな年代記",
    description: "休息も物語の一部。いつでも次の章を始められます。"
  };
}

export function buildMonthlyReport(input: MonthlyReportInput) {
  const missionByDate = new Map(
    input.missionDays.map((row) => [row.gameDate, row])
  );
  const xpByDate = new Map(
    input.xpDays.map((row) => [row.gameDate, row.earnedXp])
  );
  const modeByDate = new Map(
    input.modeDays.map((row) => [row.gameDate, row.mode])
  );
  const numberOfDays = daysInGameMonth(input.monthStart);
  const days = Array.from({ length: numberOfDays }, (_, index) => {
    const date = parseGameDate(input.monthStart);
    date.setUTCDate(index + 1);
    const gameDate = date.toISOString().slice(0, 10);
    const mission = missionByDate.get(gameDate);
    const totalMissions = mission?.totalMissions ?? 0;
    const completedMissions = mission?.completedMissions ?? 0;
    const coreCompleted = mission?.coreCompleted ?? 0;
    return {
      gameDate,
      totalMissions,
      completedMissions,
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
    activeDays: days.filter((day) => day.totalMissions > 0).length,
    dailyClearDays: days.filter((day) => day.isDailyClear).length,
    perfectDays: days.filter((day) => day.isPerfect).length
  };
  const completionRate =
    totals.missions === 0
      ? 0
      : Math.round((totals.completed / totals.missions) * 100);
  const categoryXp = [...input.categoryXp].sort(
    (left, right) => right.earnedXp - left.earnedXp
  );
  const focusTheme =
    categoryXp.find((category) => category.earnedXp > 0) ?? null;
  const title = selectMonthlyTitle(
    totals.completed,
    totals.dailyClearDays,
    totals.perfectDays
  );
  const headline =
    totals.perfectDays >= 4
      ? "誇らしい一か月の年代記です"
      : totals.dailyClearDays >= 10
        ? "着実な歩みが一章になりました"
        : totals.completed > 0
          ? "今月の一歩が記録されています"
          : "静かな月も、物語は続いております";
  const lucienComment =
    totals.completed === 0
      ? "休息の章も必要でございます。次は一番小さな一歩から参りましょう。"
      : completionRate >= 80
        ? "見事な一か月でございました。積み重ねた日々を、どうぞ誇ってくださいませ。"
        : completionRate >= 50
          ? "続けられた日が、確かな力になっております。来月も無理なく参りましょう。"
          : "すべてを完璧にする必要はございません。記録された一歩こそが成果です。";

  return {
    month: input.monthStart.slice(0, 7),
    monthStart: input.monthStart,
    monthEnd: endOfGameMonth(input.monthStart),
    firstWeekday: parseGameDate(input.monthStart).getUTCDay(),
    days,
    totals: { ...totals, completionRate },
    categoryXp,
    focusTheme,
    topHabit: input.habitCompletions[0] ?? null,
    streak: {
      currentDays: input.currentStreak,
      longestDays: input.longestStreak
    },
    title,
    headline,
    lucienComment
  };
}

export type MonthlyReportView = ReturnType<typeof buildMonthlyReport>;
