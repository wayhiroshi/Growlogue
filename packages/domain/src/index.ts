export type MissionRole = "CORE" | "BONUS";
export type MissionStatus = "PENDING" | "COMPLETED";
export type DayMode = "NORMAL" | "HOLIDAY" | "SICK" | "BUSY" | "REST";
export type NotificationLevel = "QUIET" | "STANDARD" | "ACTIVE";
export type NotificationTrigger =
  | "MORNING"
  | "MINIMUM_STEP"
  | "EVENING"
  | "STREAK_RISK"
  | "LAST_CALL"
  | "RESTART"
  | "CARE"
  | "HOLIDAY";
export type ButlerMoodState =
  | "DELIGHTED"
  | "PROUD"
  | "CHEERFUL"
  | "CALM"
  | "WORRIED"
  | "LONELY"
  | "SULKING";

export interface EncoreProgress {
  encoreCount: number;
  totalSets: number;
  canRecord: boolean;
  nextXp: number;
  softCapReached: boolean;
}

export function evaluateEncoreProgress(input: {
  encoreCount: number;
  bonusXp: number;
  maxRewardedEncores: number;
  maxDailyEncores: number;
  softCapSets: number;
}): EncoreProgress {
  const encoreCount = Math.max(0, Math.floor(input.encoreCount));
  const totalSets = encoreCount + 1;
  return {
    encoreCount,
    totalSets,
    canRecord: encoreCount < input.maxDailyEncores,
    nextXp:
      encoreCount < input.maxRewardedEncores ? Math.max(0, input.bonusXp) : 0,
    softCapReached: totalSets >= input.softCapSets
  };
}

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
const localClockFormatterCache = new Map<string, Intl.DateTimeFormat>();

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

function getLocalClockFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = localClockFormatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  localClockFormatterCache.set(timeZone, formatter);
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

export function getLocalMinute(
  now: Date,
  timeZone = "Asia/Tokyo"
): number {
  const parts = getLocalClockFormatter(timeZone).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error(`Unable to format time for timezone: ${timeZone}`);
  }
  return hour * 60 + minute;
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

function parseClock(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new RangeError(`Invalid clock value: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isQuietTime(
  localMinute: number,
  quietStart: string,
  quietEnd: string
): boolean {
  if (!Number.isInteger(localMinute) || localMinute < 0 || localMinute >= 1440) {
    throw new RangeError("localMinute must be an integer from 0 to 1439");
  }
  const start = parseClock(quietStart);
  const end = parseClock(quietEnd);
  if (start === end) return true;
  return start < end
    ? localMinute >= start && localMinute < end
    : localMinute >= start || localMinute < end;
}

export function maxNotificationsForLevel(
  level: NotificationLevel
): number {
  if (level === "QUIET") return 1;
  if (level === "STANDARD") return 3;
  return 5;
}

export function selectButlerMood(input: {
  coreCompleted: number;
  totalCompleted: number;
  totalMissions: number;
  inactiveDays: number;
  dayMode?: DayMode;
}): ButlerMoodState {
  if (input.dayMode && input.dayMode !== "NORMAL") return "CALM";
  if (
    input.totalMissions >= 3 &&
    input.totalCompleted === input.totalMissions
  ) {
    return "DELIGHTED";
  }
  if (input.coreCompleted >= 3) return "PROUD";
  if (input.totalCompleted >= 1) return "CHEERFUL";
  if (input.inactiveDays >= 7) return "WORRIED";
  if (input.inactiveDays >= 3) return "SULKING";
  if (input.inactiveDays >= 2) return "LONELY";
  return "CALM";
}

function inWindow(localMinute: number, start: number, end: number): boolean {
  return localMinute >= start && localMinute < end;
}

export function selectNotificationTrigger(input: {
  localMinute: number;
  quietHoursStart: string;
  quietHoursEnd: string;
  notificationLevel: NotificationLevel;
  dayMode: DayMode;
  coreCompleted: number;
  totalCompleted: number;
  totalMissions: number;
  inactiveDays: number;
}): NotificationTrigger | null {
  if (
    input.dayMode === "REST" ||
    input.totalMissions === 0 ||
    isQuietTime(
      input.localMinute,
      input.quietHoursStart,
      input.quietHoursEnd
    )
  ) {
    return null;
  }

  if (input.dayMode === "SICK") {
    return inWindow(input.localMinute, 18 * 60, 20 * 60) ? "CARE" : null;
  }
  if (input.dayMode === "HOLIDAY") {
    return inWindow(input.localMinute, 10 * 60, 12 * 60)
      ? "HOLIDAY"
      : null;
  }
  if (input.dayMode === "BUSY") {
    return inWindow(input.localMinute, 20 * 60, 22 * 60)
      ? "MINIMUM_STEP"
      : null;
  }

  if (
    input.inactiveDays >= 7 &&
    inWindow(input.localMinute, 10 * 60, 20 * 60)
  ) {
    return "RESTART";
  }

  const pending = input.totalCompleted < input.totalMissions;
  const dailyClearPending = input.coreCompleted < 3;
  if (
    inWindow(input.localMinute, 8 * 60, 11 * 60) &&
    input.notificationLevel !== "QUIET"
  ) {
    return "MORNING";
  }
  if (
    inWindow(input.localMinute, 12 * 60, 15 * 60) &&
    input.totalCompleted === 0 &&
    input.notificationLevel === "ACTIVE"
  ) {
    return "MINIMUM_STEP";
  }
  if (inWindow(input.localMinute, 17 * 60, 20 * 60) && pending) {
    return "EVENING";
  }
  if (
    inWindow(input.localMinute, 20 * 60, 22 * 60) &&
    dailyClearPending &&
    input.notificationLevel !== "QUIET"
  ) {
    return "STREAK_RISK";
  }
  if (
    inWindow(input.localMinute, 22 * 60, 23 * 60 + 30) &&
    pending &&
    input.notificationLevel === "ACTIVE"
  ) {
    return "LAST_CALL";
  }
  return null;
}

function addDays(gameDate: string, days: number): string {
  const date = new Date(`${gameDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isProtectedGap(
  previous: string,
  current: string,
  protectedDates: ReadonlySet<string>
): boolean {
  const distance = dateDistanceInDays(previous, current);
  if (distance <= 1) return distance === 1;
  for (let offset = 1; offset < distance; offset += 1) {
    if (!protectedDates.has(addDays(previous, offset))) return false;
  }
  return true;
}

export function calculateStreaks(
  clearDates: readonly string[],
  protectedDates: ReadonlySet<string> = new Set()
): { currentDays: number; longestDays: number; lastClearGameDate: string | null } {
  const uniqueDates = [...new Set(clearDates)].sort();
  let currentDays = 0;
  let longestDays = 0;
  let previous: string | null = null;

  for (const date of uniqueDates) {
    currentDays =
      previous && isProtectedGap(previous, date, protectedDates)
        ? currentDays + 1
        : 1;
    longestDays = Math.max(longestDays, currentDays);
    previous = date;
  }

  return {
    currentDays,
    longestDays,
    lastClearGameDate: uniqueDates.at(-1) ?? null
  };
}
