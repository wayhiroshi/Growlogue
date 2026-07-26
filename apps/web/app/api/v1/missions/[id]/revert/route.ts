import { apiError, getApiSession, toApiError } from "@/lib/api";
import { mutateMission } from "@/lib/game-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  const idempotencyKey = request.headers.get("Idempotency-Key");
  if (!idempotencyKey || idempotencyKey.length > 128) {
    return apiError(
      "IDEMPOTENCY_KEY_REQUIRED",
      "Idempotency-Keyが必要です。",
      400
    );
  }
  try {
    const { id } = await context.params;
    return Response.json(
      await mutateMission(session.user.id, id, idempotencyKey, "revert")
    );
  } catch (error) {
    return toApiError(error);
  }
}
