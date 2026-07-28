import { apiError, getApiSession, toApiError } from "@/lib/api";
import { getTodayMode, setTodayMode } from "@/lib/game-service";
import { z } from "zod";

const updateSchema = z.object({
  mode: z.enum(["NORMAL", "HOLIDAY", "SICK", "BUSY", "REST"])
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  return Response.json(await getTodayMode(session.user.id));
}

export async function PUT(request: Request) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "今日のモードを確認してください。", 400);
  }
  try {
    const dailyMode = await setTodayMode(session.user.id, parsed.data.mode);
    return Response.json({
      gameDate: dailyMode.gameDate,
      mode: dailyMode.mode
    });
  } catch (error) {
    return toApiError(error);
  }
}
