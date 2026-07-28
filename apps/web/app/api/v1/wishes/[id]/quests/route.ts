import { apiError, getApiSession, readJson, toApiError } from "@/lib/api";
import { addQuest } from "@/lib/life-unlocks-service";
import { createQuestSchema } from "@/lib/life-unlocks-validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  const parsed = createQuestSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Questの入力内容を確認してください。", 400);
  }
  try {
    const { id } = await context.params;
    return Response.json(
      { wish: await addQuest(session.user.id, id, parsed.data) },
      { status: 201 }
    );
  } catch (error) {
    return toApiError(error);
  }
}
