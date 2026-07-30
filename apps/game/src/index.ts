import type { DayMode } from "@growlogue/domain";
import {
  completeOnboarding,
  createHabit,
  ensureUserFoundation,
  getDailyReviewSnapshot,
  getDashboard,
  getTodayMode,
  listCompanions,
  listHabits,
  mutateMission,
  recordMissionEncore,
  setHabitActive,
  setTodayMode
} from "./service";

const INTERNAL_USER_HEADER = "X-Growlogue-User-Id";
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff"
};

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: PRIVATE_HEADERS });
}

function errorResponse(code: string, status = 500): Response {
  return json({ error: { code } }, status);
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function statusForError(code: string): number {
  if (
    code === "MISSION_NOT_FOUND" ||
    code === "HABIT_NOT_FOUND" ||
    code === "CATEGORY_NOT_FOUND"
  ) {
    return 404;
  }
  if (
    code === "MISSION_NOT_COMPLETED" ||
    code === "MISSION_NOT_REPEATABLE" ||
    code === "ENCORE_LIMIT_REACHED" ||
    code === "ENCORE_EXISTS" ||
    code === "IDEMPOTENCY_KEY_CONFLICT"
  ) {
    return 409;
  }
  if (code === "AT_LEAST_THREE_HABITS_REQUIRED") return 400;
  return 500;
}

export default {
  async fetch(request, env): Promise<Response> {
    const userId = request.headers.get(INTERNAL_USER_HEADER);
    if (!userId || userId.length > 128) {
      return errorResponse("UNAUTHORIZED", 401);
    }
    const url = new URL(request.url);
    const path = url.pathname.split("/").filter(Boolean);

    try {
      if (request.method === "GET" && url.pathname === "/foundation") {
        return json({ result: await ensureUserFoundation(env.DB, userId) });
      }
      if (request.method === "POST" && url.pathname === "/onboarding") {
        const body = await readJson<{ templateIds: string[] }>(request);
        if (!body) return errorResponse("INVALID_INPUT", 400);
        await completeOnboarding(env.DB, userId, body.templateIds);
        return json({ result: null });
      }
      if (request.method === "GET" && url.pathname === "/dashboard") {
        return json({ result: await getDashboard(env.DB, userId) });
      }
      if (request.method === "GET" && url.pathname === "/companions") {
        return json({ result: await listCompanions(env.DB, userId) });
      }
      if (request.method === "GET" && url.pathname === "/daily-review") {
        return json({ result: await getDailyReviewSnapshot(env.DB, userId) });
      }
      if (request.method === "GET" && url.pathname === "/day-mode") {
        return json({ result: await getTodayMode(env.DB, userId) });
      }
      if (request.method === "POST" && url.pathname === "/day-mode") {
        const body = await readJson<{ mode: DayMode }>(request);
        if (!body) return errorResponse("INVALID_INPUT", 400);
        return json({ result: await setTodayMode(env.DB, userId, body.mode) });
      }
      if (request.method === "GET" && url.pathname === "/habits") {
        return json({ result: await listHabits(env.DB, userId) });
      }
      if (request.method === "POST" && url.pathname === "/habits") {
        const body = await readJson<{
          title: string;
          categoryId: string;
          minimumRule: string;
          baseXp: number;
        }>(request);
        if (!body) return errorResponse("INVALID_INPUT", 400);
        return json({ result: await createHabit(env.DB, userId, body) }, 201);
      }

      const resourceId = path[1];
      if (!resourceId || resourceId.length > 128) {
        return errorResponse("NOT_FOUND", 404);
      }
      if (
        request.method === "POST" &&
        path[0] === "missions" &&
        (path[2] === "complete" ||
          path[2] === "revert" ||
          path[2] === "encore")
      ) {
        const body = await readJson<{ idempotencyKey: string }>(request);
        if (!body?.idempotencyKey || body.idempotencyKey.length > 128) {
          return errorResponse("IDEMPOTENCY_KEY_REQUIRED", 400);
        }
        return json({
          result:
            path[2] === "encore"
              ? await recordMissionEncore(
                  env.DB,
                  userId,
                  resourceId,
                  body.idempotencyKey
                )
              : await mutateMission(
                  env.DB,
                  userId,
                  resourceId,
                  body.idempotencyKey,
                  path[2]
                )
        });
      }
      if (
        request.method === "POST" &&
        path[0] === "habits" &&
        path[2] === "active"
      ) {
        const body = await readJson<{ isActive: boolean }>(request);
        if (!body) return errorResponse("INVALID_INPUT", 400);
        await setHabitActive(env.DB, userId, resourceId, body.isActive);
        return json({ result: null });
      }
      return errorResponse("NOT_FOUND", 404);
    } catch (error) {
      const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
      console.error(
        JSON.stringify({
          message: "game_service_request_failed",
          error: code
        })
      );
      return errorResponse(code, statusForError(code));
    }
  }
} satisfies ExportedHandler<CloudflareEnv>;
