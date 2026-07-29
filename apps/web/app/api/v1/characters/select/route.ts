import { apiError, getApiSession, toApiError } from "@/lib/api";
import { selectCompanion } from "@/lib/game-service";
import { z } from "zod";

const schema = z.object({
  characterId: z.string().min(1).max(80)
});

export async function POST(request: Request) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "相棒を選び直してください。", 400);
  }
  try {
    const character = await selectCompanion(
      session.user.id,
      parsed.data.characterId
    );
    return Response.json({ character });
  } catch (error) {
    if (error instanceof Error && error.message === "CHARACTER_NOT_FOUND") {
      return apiError("NOT_FOUND", "この相棒は選択できません。", 404);
    }
    return toApiError(error);
  }
}
