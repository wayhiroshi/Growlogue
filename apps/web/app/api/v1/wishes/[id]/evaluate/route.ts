import {
  apiError,
  getApiSession,
  getIdempotencyKey,
  toApiError
} from "@/lib/api";
import { evaluateAndUnlockWish } from "@/lib/life-unlocks-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  const idempotencyKey = getIdempotencyKey(request);
  if (!idempotencyKey) {
    return apiError(
      "IDEMPOTENCY_KEY_REQUIRED",
      "Idempotency-Keyが必要です。",
      400
    );
  }
  try {
    const { id } = await context.params;
    return Response.json(
      await evaluateAndUnlockWish(session.user.id, id, idempotencyKey)
    );
  } catch (error) {
    return toApiError(error);
  }
}
