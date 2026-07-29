import { apiError, getApiSession, toApiError } from "@/lib/api";
import { getRuntime } from "@/lib/runtime";
import { britishGentlemanWorld } from "@growlogue/content";
import { z } from "zod";

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const updateSchema = z.union([
  z.object({
    notificationLevel: z.enum(["QUIET", "STANDARD", "ACTIVE"]),
    quietHoursStart: clock,
    quietHoursEnd: clock
  }),
  z.object({
    characterId: z.string().min(1).max(80)
  })
]);

export async function PATCH(request: Request) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "通知設定を確認してください。", 400);
  }
  try {
    if ("characterId" in parsed.data) {
      const character = await getRuntime().prisma.character.findFirst({
        where: {
          id: parsed.data.characterId,
          worldId: britishGentlemanWorld.id
        }
      });
      if (!character) {
        return apiError("NOT_FOUND", "この相棒は選択できません。", 404);
      }
      await getRuntime().prisma.characterState.update({
        where: { userId: session.user.id },
        data: { characterId: character.id }
      });
      return Response.json({ character });
    }
    const profile = await getRuntime().prisma.profile.update({
      where: { userId: session.user.id },
      data: parsed.data
    });
    return Response.json({
      notificationLevel: profile.notificationLevel,
      quietHoursStart: profile.quietHoursStart,
      quietHoursEnd: profile.quietHoursEnd
    });
  } catch (error) {
    return toApiError(error);
  }
}
