import {
  apiError,
  getApiSession,
  getIdempotencyKey,
  readJson,
  toApiError
} from "@/lib/api";
import {
  addQuest,
  completeWishReward,
  createWish,
  evaluateAndUnlockWish,
  listWishes,
  recordConditionFact,
  updateWish
} from "@/lib/life-unlocks-service";
import {
  createQuestSchema,
  createWishSchema,
  recordFactSchema,
  updateWishSchema
} from "@/lib/life-unlocks-validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path?: string[] }> };

function invalidRoute() {
  return apiError("NOT_FOUND", "APIが見つかりません。", 404);
}

export async function GET(request: Request, context: RouteContext) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  const { path = [] } = await context.params;
  if (path.length !== 1 || path[0] !== "_root") return invalidRoute();
  return Response.json({ wishes: await listWishes(session.user.id) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  const { path = [] } = await context.params;
  const wishId = path[0];
  if (path.length !== 1 || !wishId) return invalidRoute();
  const parsed = updateWishSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Wishの入力内容を確認してください。", 400);
  }
  try {
    return Response.json({
      wish: await updateWish(session.user.id, wishId, parsed.data)
    });
  } catch (error) {
    return toApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getApiSession(request);
  if (!session) return apiError("UNAUTHORIZED", "ログインが必要です。", 401);
  const { path = [] } = await context.params;

  try {
    if (path.length === 1 && path[0] === "_root") {
      const parsed = createWishSchema.safeParse(await readJson(request));
      if (!parsed.success) {
        return apiError(
          "INVALID_INPUT",
          "Wish、Quest、条件の入力内容を確認してください。",
          400
        );
      }
      return Response.json(
        { wish: await createWish(session.user.id, parsed.data) },
        { status: 201 }
      );
    }
    if (path.length !== 2) return invalidRoute();
    const [wishId, action] = path;
    if (!wishId || !action) return invalidRoute();

    if (action === "quests") {
      const parsed = createQuestSchema.safeParse(await readJson(request));
      if (!parsed.success) {
        return apiError(
          "INVALID_INPUT",
          "Questの入力内容を確認してください。",
          400
        );
      }
      return Response.json(
        { wish: await addQuest(session.user.id, wishId, parsed.data) },
        { status: 201 }
      );
    }
    if (action === "facts") {
      const parsed = recordFactSchema.safeParse(await readJson(request));
      if (!parsed.success) {
        return apiError(
          "INVALID_INPUT",
          "記録する値を確認してください。",
          400
        );
      }
      return Response.json({
        wish: await recordConditionFact(
          session.user.id,
          wishId,
          parsed.data.conditionId,
          parsed.data.value
        )
      });
    }
    if (action !== "evaluate" && action !== "complete") {
      return invalidRoute();
    }
    const idempotencyKey = getIdempotencyKey(request);
    if (!idempotencyKey) {
      return apiError(
        "IDEMPOTENCY_KEY_REQUIRED",
        "Idempotency-Keyが必要です。",
        400
      );
    }
    return Response.json(
      action === "evaluate"
        ? await evaluateAndUnlockWish(
            session.user.id,
            wishId,
            idempotencyKey
          )
        : await completeWishReward(session.user.id, wishId, idempotencyKey)
    );
  } catch (error) {
    return toApiError(error);
  }
}
