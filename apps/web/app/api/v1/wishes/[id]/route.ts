import { apiError, getApiSession, readJson, toApiError } from "@/lib/api";
import { updateWish } from "@/lib/life-unlocks-service";
import { updateWishSchema } from "@/lib/life-unlocks-validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  const parsed = updateWishSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Wishの入力内容を確認してください。", 400);
  }
  try {
    const { id } = await context.params;
    return Response.json({
      wish: await updateWish(session.user.id, id, parsed.data)
    });
  } catch (error) {
    return toApiError(error);
  }
}
