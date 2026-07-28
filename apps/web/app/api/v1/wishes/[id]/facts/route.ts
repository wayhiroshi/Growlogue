import { apiError, getApiSession, readJson, toApiError } from "@/lib/api";
import { recordConditionFact } from "@/lib/life-unlocks-service";
import { recordFactSchema } from "@/lib/life-unlocks-validation";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  const parsed = recordFactSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "記録する値を確認してください。", 400);
  }
  try {
    const { id } = await context.params;
    return Response.json({
      wish: await recordConditionFact(
        session.user.id,
        id,
        parsed.data.conditionId,
        parsed.data.value
      )
    });
  } catch (error) {
    return toApiError(error);
  }
}
