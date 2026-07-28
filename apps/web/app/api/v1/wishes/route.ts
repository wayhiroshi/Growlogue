import { apiError, getApiSession, readJson, toApiError } from "@/lib/api";
import {
  createWish,
  listWishes
} from "@/lib/life-unlocks-service";
import { createWishSchema } from "@/lib/life-unlocks-validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  return Response.json({ wishes: await listWishes(session.user.id) });
}

export async function POST(request: Request) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  const parsed = createWishSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError(
      "INVALID_INPUT",
      "Wish、Quest、条件の入力内容を確認してください。",
      400
    );
  }
  try {
    return Response.json(
      { wish: await createWish(session.user.id, parsed.data) },
      { status: 201 }
    );
  } catch (error) {
    return toApiError(error);
  }
}
