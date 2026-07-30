import type * as GameWorkerService from "../../game/src/service";
import type { DayMode } from "@growlogue/domain";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const INTERNAL_USER_HEADER = "X-Growlogue-User-Id";

type ServiceResult<T extends (...args: never[]) => unknown> = Awaited<
  ReturnType<T>
>;

async function callGame<T>(
  userId: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const { env } = getCloudflareContext();
  const headers = new Headers(init?.headers);
  headers.set(INTERNAL_USER_HEADER, userId);
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await env.GAME.fetch(
    new Request(`https://game.internal${path}`, { ...init, headers })
  );
  const body = (await response.json()) as {
    result?: T;
    error?: { code?: string };
  };
  if (!response.ok) {
    throw new Error(body.error?.code ?? "GAME_SERVICE_UNAVAILABLE");
  }
  return body.result as T;
}

export function ensureUserFoundation(userId: string) {
  return callGame<
    ServiceResult<typeof GameWorkerService.ensureUserFoundation>
  >(userId, "/foundation");
}

export function completeOnboarding(
  userId: string,
  templateIds: readonly string[]
) {
  return callGame<void>(userId, "/onboarding", {
    method: "POST",
    body: JSON.stringify({ templateIds })
  });
}

export function mutateMission(
  userId: string,
  missionId: string,
  idempotencyKey: string,
  action: "complete" | "revert"
) {
  return callGame<ServiceResult<typeof GameWorkerService.mutateMission>>(
    userId,
    `/missions/${encodeURIComponent(missionId)}/${action}`,
    { method: "POST", body: JSON.stringify({ idempotencyKey }) }
  );
}

export function recordMissionEncore(
  userId: string,
  missionId: string,
  idempotencyKey: string
) {
  return callGame<
    ServiceResult<typeof GameWorkerService.recordMissionEncore>
  >(userId, `/missions/${encodeURIComponent(missionId)}/encore`, {
    method: "POST",
    body: JSON.stringify({ idempotencyKey })
  });
}

export function getDashboard(userId: string) {
  return callGame<ServiceResult<typeof GameWorkerService.getDashboard>>(
    userId,
    "/dashboard"
  );
}

export function listCompanions(userId: string) {
  return callGame<ServiceResult<typeof GameWorkerService.listCompanions>>(
    userId,
    "/companions"
  );
}

export function getDailyReviewSnapshot(userId: string) {
  return callGame<
    ServiceResult<typeof GameWorkerService.getDailyReviewSnapshot>
  >(userId, "/daily-review");
}

export function getTodayMode(userId: string) {
  return callGame<ServiceResult<typeof GameWorkerService.getTodayMode>>(
    userId,
    "/day-mode"
  );
}

export function setTodayMode(userId: string, mode: DayMode) {
  return callGame<ServiceResult<typeof GameWorkerService.setTodayMode>>(
    userId,
    "/day-mode",
    { method: "POST", body: JSON.stringify({ mode }) }
  );
}

export function listHabits(userId: string) {
  return callGame<ServiceResult<typeof GameWorkerService.listHabits>>(
    userId,
    "/habits"
  );
}

export function createHabit(
  userId: string,
  input: {
    title: string;
    categoryId: string;
    minimumRule: string;
    baseXp: number;
  }
) {
  return callGame<ServiceResult<typeof GameWorkerService.createHabit>>(
    userId,
    "/habits",
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function setHabitActive(
  userId: string,
  habitId: string,
  isActive: boolean
) {
  return callGame<void>(
    userId,
    `/habits/${encodeURIComponent(habitId)}/active`,
    { method: "POST", body: JSON.stringify({ isActive }) }
  );
}
