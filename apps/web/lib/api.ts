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
  if (message === "MISSION_NOT_COMPLETED") {
    return apiError(
      "MISSION_NOT_COMPLETED",
      "最初の達成後に、もう一巡を記録できます。",
      409
    );
  }
  if (message === "MISSION_NOT_REPEATABLE") {
    return apiError(
      "MISSION_NOT_REPEATABLE",
      "このミッションは、もう一巡の対象ではありません。",
      409
    );
  }
  if (message === "ENCORE_LIMIT_REACHED") {
    return apiError(
      "ENCORE_LIMIT_REACHED",
      "本日の記録上限に到達しました。ここで休むのも立派な鍛錬です。",
      409
    );
  }
  if (message === "ENCORE_EXISTS") {
    return apiError(
      "ENCORE_EXISTS",
      "追加セットを記録済みのため、最初の達成は取り消せません。",
      409
    );
  }
  if (message === "IDEMPOTENCY_KEY_CONFLICT") {
    return apiError(
      "IDEMPOTENCY_KEY_CONFLICT",
      "同じ操作キーが別の記録に使用されています。",
      409
    );
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
  if (message === "SHARE_LINK_NOT_FOUND") {
    return apiError(
      "SHARE_LINK_NOT_FOUND",
      "共有リンクが見つかりません。",
      404
    );
  }
  if (message === "SHARE_CARD_RENDER_FAILED") {
    return apiError(
      "SHARE_CARD_RENDER_FAILED",
      "共有カードを生成できませんでした。時間をおいて再度お試しください。",
      503
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
