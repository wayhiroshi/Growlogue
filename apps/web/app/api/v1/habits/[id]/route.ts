import { apiError, getApiSession, toApiError } from "@/lib/api";
import { setHabitActive } from "@/lib/game-service";
import { z } from "zod";

const schema = z.object({ isActive: z.boolean() });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "入力内容を確認してください。", 400);
  }
  try {
    const { id } = await context.params;
    await setHabitActive(session.user.id, id, parsed.data.isActive);
    return Response.json({ ok: true });
  } catch (error) {
    return toApiError(error);
  }
}
