import { apiError, getApiSession, toApiError } from "@/lib/api";
import { createHabit, listHabits } from "@/lib/game-service";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().trim().min(1).max(60),
  categoryId: z.string().min(1),
  minimumRule: z.string().trim().min(1).max(120),
  baseXp: z.number().int().min(5).max(20)
});

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  return Response.json({ habits: await listHabits(session.user.id) });
}

export async function POST(request: Request) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "習慣の入力内容を確認してください。", 400);
  }
  try {
    return Response.json(
      { habit: await createHabit(session.user.id, parsed.data) },
      { status: 201 }
    );
  } catch (error) {
    return toApiError(error);
  }
}
