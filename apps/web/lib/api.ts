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

export function toApiError(error: unknown): Response {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  if (message === "MISSION_NOT_FOUND") {
    return apiError("MISSION_NOT_FOUND", "ミッションが見つかりません。", 404);
  }
  if (message === "COMPLETION_NOT_FOUND") {
    return apiError("COMPLETION_NOT_FOUND", "達成記録が見つかりません。", 409);
  }
  console.error(
    JSON.stringify({
      message: "api_request_failed",
      error: message
    })
  );
  return apiError("INTERNAL_ERROR", "処理を完了できませんでした。", 500);
}
