import type {
  CreateQuestInput,
  CreateWishInput,
  UpdateWishInput
} from "@growlogue/life-unlocks";
import {
  addQuest,
  completeWishReward,
  createWish,
  evaluateAndUnlockWish,
  getPrimaryWish,
  listWishes,
  recordConditionFact,
  updateWish
} from "./service";

const INTERNAL_USER_HEADER = "X-Growlogue-User-Id";
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff"
};

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: PRIVATE_HEADERS });
}

function errorResponse(code: string, message: string, status: number): Response {
  return json({ error: { code, message } }, status);
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function statusForError(code: string): number {
  if (code === "WISH_NOT_FOUND" || code === "CONDITION_NOT_FOUND") return 404;
  if (
    code === "CONDITION_NOT_MANUAL" ||
    code === "WISH_NOT_READY" ||
    code === "WISH_NOT_UNLOCKED"
  ) {
    return 409;
  }
  return 500;
}

export default {
  async fetch(request, env): Promise<Response> {
    const userId = request.headers.get(INTERNAL_USER_HEADER);
    if (!userId || userId.length > 128) {
      return errorResponse("UNAUTHORIZED", "内部認証が必要です。", 401);
    }

    const url = new URL(request.url);
    const path = url.pathname.split("/").filter(Boolean);

    try {
      if (request.method === "GET" && url.pathname === "/wishes") {
        return json({ wishes: await listWishes(env.DB, userId) });
      }
      if (request.method === "GET" && url.pathname === "/wishes/primary") {
        return json({ wish: await getPrimaryWish(env.DB, userId) });
      }
      if (request.method === "POST" && url.pathname === "/wishes") {
        const input = await readJson<CreateWishInput>(request);
        if (!input) {
          return errorResponse("INVALID_INPUT", "入力が必要です。", 400);
        }
        return json({ wish: await createWish(env.DB, userId, input) }, 201);
      }

      const wishId = path[0] === "wishes" ? path[1] : undefined;
      if (!wishId || wishId.length > 128) {
        return errorResponse("NOT_FOUND", "APIが見つかりません。", 404);
      }

      if (request.method === "PATCH" && path.length === 2) {
        const input = await readJson<UpdateWishInput>(request);
        if (!input) {
          return errorResponse("INVALID_INPUT", "入力が必要です。", 400);
        }
        return json({ wish: await updateWish(env.DB, userId, wishId, input) });
      }
      if (request.method === "POST" && path[2] === "quests") {
        const input = await readJson<CreateQuestInput>(request);
        if (!input) {
          return errorResponse("INVALID_INPUT", "入力が必要です。", 400);
        }
        return json(
          { wish: await addQuest(env.DB, userId, wishId, input) },
          201
        );
      }
      if (request.method === "POST" && path[2] === "facts") {
        const input = await readJson<{ conditionId: string; value: number }>(
          request
        );
        if (!input) {
          return errorResponse("INVALID_INPUT", "入力が必要です。", 400);
        }
        return json({
          wish: await recordConditionFact(
            env.DB,
            userId,
            wishId,
            input.conditionId,
            input.value
          )
        });
      }
      if (
        request.method === "POST" &&
        (path[2] === "evaluate" || path[2] === "complete")
      ) {
        const input = await readJson<{ idempotencyKey: string }>(request);
        if (!input?.idempotencyKey || input.idempotencyKey.length > 128) {
          return errorResponse(
            "IDEMPOTENCY_KEY_REQUIRED",
            "Idempotency-Keyが必要です。",
            400
          );
        }
        return json(
          path[2] === "evaluate"
            ? await evaluateAndUnlockWish(
                env.DB,
                userId,
                wishId,
                input.idempotencyKey
              )
            : await completeWishReward(
                env.DB,
                userId,
                wishId,
                input.idempotencyKey
              )
        );
      }
      return errorResponse("NOT_FOUND", "APIが見つかりません。", 404);
    } catch (error) {
      const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
      console.error(
        JSON.stringify({
          message: "life_unlocks_request_failed",
          error: code
        })
      );
      return errorResponse(
        code,
        statusForError(code) === 500
          ? "Life Unlocksを処理できませんでした。"
          : code,
        statusForError(code)
      );
    }
  }
} satisfies ExportedHandler<CloudflareEnv>;
