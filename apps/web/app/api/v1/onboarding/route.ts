import { apiError, getApiSession, toApiError } from "@/lib/api";
import { completeOnboarding } from "@/lib/game-service";
import { z } from "zod";

const schema = z.object({
  templateIds: z.array(z.string()).min(3).max(10)
});

export async function POST(request: Request) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "習慣を3つ以上選んでください。", 400);
  }
  try {
    await completeOnboarding(session.user.id, parsed.data.templateIds);
    return Response.json({ ok: true });
  } catch (error) {
    return toApiError(error);
  }
}
