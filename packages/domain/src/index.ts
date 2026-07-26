export type MissionRole = "CORE" | "BONUS";
export type MissionStatus = "PENDING" | "COMPLETED";

export interface MissionSummary {
  role: MissionRole;
  status: MissionStatus;
}

export interface DailyResult {
  coreCompleted: number;
  totalCompleted: number;
  totalMissions: number;
  isDailyClear: boolean;
  isPerfect: boolean;
}

export interface HabitCandidate {
  id: string;
  categoryKey: string;
  preferredOrder: number;
  isActive: boolean;
}

export interface SelectedMission extends HabitCandidate {
  role: MissionRole;
  position: number;
}

export interface StreakInput {
  previousGameDate: string | null;
  previousStreak: number;
  currentGameDate: string;
  wasDailyClear: boolean;
  isRestDay?: boolean;
}

const localDateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getLocalDateFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = localDateFormatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  localDateFormatterCache.set(timeZone, formatter);
  return formatter;
}

export function getGameDate(
  now: Date,
  timeZone = "Asia/Tokyo",
  resetHour = 4
): string {
  if (!Number.isInteger(resetHour) || resetHour < 0 || resetHour > 23) {
    throw new RangeError("resetHour must be an integer from 0 to 23");
  }

  const shifted = new Date(now.getTime() - resetHour * 60 * 60 * 1000);
  const parts = getLocalDateFormatter(timeZone).formatToParts(shifted);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Unable to format date for timezone: ${timeZone}`);
  }
  return `${year}-${month}-${day}`;
}

export function evaluateDailyProgress(
  missions: readonly MissionSummary[]
): DailyResult {
  const coreCompleted = missions.filter(
    (mission) => mission.role === "CORE" && mission.status === "COMPLETED"
  ).length;
  const totalCompleted = missions.filter(
    (mission) => mission.status === "COMPLETED"
  ).length;

  return {
    coreCompleted,
    totalCompleted,
    totalMissions: missions.length,
    isDailyClear: coreCompleted >= 3,
    isPerfect: missions.length >= 3 && totalCompleted === missions.length
  };
}

export function xpRequiredForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) {
    throw new RangeError("level must be a positive integer");
  }
  return (level - 1) ** 2 * 100;
}

export function levelFromXp(totalXp: number): number {
  if (!Number.isFinite(totalXp) || totalXp < 0) return 1;
  return Math.floor(Math.sqrt(totalXp / 100)) + 1;
}

export function selectDailyMissions(
  candidates: readonly HabitCandidate[],
  gameDate: string
): SelectedMission[] {
  const active = candidates
    .filter((candidate) => candidate.isActive)
    .sort((left, right) => {
      if (left.preferredOrder !== right.preferredOrder) {
        return left.preferredOrder - right.preferredOrder;
      }
      return left.id.localeCompare(right.id);
    });

  if (active.length === 0) return [];

  const dayNumber = Math.floor(
    Date.parse(`${gameDate}T00:00:00.000Z`) / 86_400_000
  );
  const offset = Math.abs(dayNumber) % active.length;
  const rotated = [...active.slice(offset), ...active.slice(0, offset)];

  const selected: HabitCandidate[] = [];
  const seenCategories = new Set<string>();

  for (const candidate of rotated) {
    if (selected.length >= 5) break;
    if (!seenCategories.has(candidate.categoryKey)) {
      selected.push(candidate);
      seenCategories.add(candidate.categoryKey);
    }
  }
  for (const candidate of rotated) {
    if (selected.length >= 5) break;
    if (!selected.some((item) => item.id === candidate.id)) {
      selected.push(candidate);
    }
  }

  return selected.map((candidate, index) => ({
    ...candidate,
    role: index < 3 ? "CORE" : "BONUS",
    position: index + 1
  }));
}

function dateDistanceInDays(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00.000Z`) -
      Date.parse(`${from}T00:00:00.000Z`)) /
      86_400_000
  );
}

export function nextStreak(input: StreakInput): number {
  if (input.isRestDay) return input.previousStreak;
  if (!input.wasDailyClear) return input.previousStreak;
  if (!input.previousGameDate) return 1;
  if (input.previousGameDate === input.currentGameDate) {
    return Math.max(1, input.previousStreak);
  }

  return dateDistanceInDays(
    input.previousGameDate,
    input.currentGameDate
  ) === 1
    ? input.previousStreak + 1
    : 1;
}
