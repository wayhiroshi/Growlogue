import { getAuth } from "./auth";

export async function getApiSession(request: Request) {
  return getAuth().api.getSession({ headers: request.headers });
}

export function apiError(
  code: string,
  message: string,
  status: number
): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function getIdempotencyKey(request: Request): string | null {
  const value = request.headers.get("Idempotency-Key");
  return value && value.length <= 128 ? value : null;
}

export function toApiError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  if (message === "MISSION_NOT_FOUND") {
    return apiError("MISSION_NOT_FOUND", "ミッションが見つかりません。", 404);
  }
  if (message === "COMPLETION_NOT_FOUND") {
    return apiError("COMPLETION_NOT_FOUND", "達成記録が見つかりません。", 409);
  }
  if (message === "WISH_NOT_FOUND") {
    return apiError("WISH_NOT_FOUND", "Wishが見つかりません。", 404);
  }
  if (message === "CONDITION_NOT_FOUND") {
    return apiError("CONDITION_NOT_FOUND", "条件が見つかりません。", 404);
  }
  if (message === "CONDITION_NOT_MANUAL") {
    return apiError(
      "CONDITION_NOT_MANUAL",
      "この条件は手入力では更新できません。",
      409
    );
  }
  if (message === "WISH_NOT_READY") {
    return apiError(
      "WISH_NOT_READY",
      "まだすべてのQuest条件を満たしていません。",
      409
    );
  }
  if (message === "WISH_NOT_UNLOCKED") {
    return apiError(
      "WISH_NOT_UNLOCKED",
      "Rewardはまだ解放されていません。",
      409
    );
  }
  console.error(
    JSON.stringify({
      message: "api_request_failed",
      error: message
    })
  );
  return apiError("INTERNAL_ERROR", "処理を完了できませんでした。", 500);
}
