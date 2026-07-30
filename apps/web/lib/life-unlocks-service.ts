import type {
  CreateQuestInput,
  CreateWishInput,
  UpdateWishInput,
  WishView
} from "@growlogue/life-unlocks";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const INTERNAL_USER_HEADER = "X-Growlogue-User-Id";

async function callLifeUnlocks<T>(
  userId: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const { env } = getCloudflareContext();
  const headers = new Headers(init?.headers);
  headers.set(INTERNAL_USER_HEADER, userId);
  if (init?.body) headers.set("Content-Type", "application/json");

  const response = await env.LIFE_UNLOCKS.fetch(
    new Request(`https://life-unlocks.internal${path}`, {
      ...init,
      headers
    })
  );
  const result = (await response.json()) as T & {
    error?: { code?: string };
  };
  if (!response.ok) {
    throw new Error(result.error?.code ?? "LIFE_UNLOCKS_UNAVAILABLE");
  }
  return result;
}

export async function listWishes(userId: string): Promise<WishView[]> {
  const result = await callLifeUnlocks<{ wishes: WishView[] }>(
    userId,
    "/wishes"
  );
  return result.wishes;
}

export async function getPrimaryWish(userId: string): Promise<WishView | null> {
  const result = await callLifeUnlocks<{ wish: WishView | null }>(
    userId,
    "/wishes/primary"
  );
  return result.wish;
}

export async function createWish(
  userId: string,
  input: CreateWishInput
): Promise<WishView> {
  const result = await callLifeUnlocks<{ wish: WishView }>(userId, "/wishes", {
    method: "POST",
    body: JSON.stringify(input)
  });
  return result.wish;
}

export async function updateWish(
  userId: string,
  wishId: string,
  input: UpdateWishInput
): Promise<WishView> {
  const result = await callLifeUnlocks<{ wish: WishView }>(
    userId,
    `/wishes/${encodeURIComponent(wishId)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return result.wish;
}

export async function addQuest(
  userId: string,
  wishId: string,
  input: CreateQuestInput
): Promise<WishView> {
  const result = await callLifeUnlocks<{ wish: WishView }>(
    userId,
    `/wishes/${encodeURIComponent(wishId)}/quests`,
    { method: "POST", body: JSON.stringify(input) }
  );
  return result.wish;
}

export async function recordConditionFact(
  userId: string,
  wishId: string,
  conditionId: string,
  value: number
): Promise<WishView> {
  const result = await callLifeUnlocks<{ wish: WishView }>(
    userId,
    `/wishes/${encodeURIComponent(wishId)}/facts`,
    {
      method: "POST",
      body: JSON.stringify({ conditionId, value })
    }
  );
  return result.wish;
}

async function transitionWish(
  userId: string,
  wishId: string,
  action: "evaluate" | "complete",
  idempotencyKey: string
): Promise<{ applied: boolean; wish: WishView }> {
  return callLifeUnlocks(userId, `/wishes/${encodeURIComponent(wishId)}/${action}`, {
    method: "POST",
    body: JSON.stringify({ idempotencyKey })
  });
}

export function evaluateAndUnlockWish(
  userId: string,
  wishId: string,
  idempotencyKey: string
) {
  return transitionWish(userId, wishId, "evaluate", idempotencyKey);
}

export function completeWishReward(
  userId: string,
  wishId: string,
  idempotencyKey: string
) {
  return transitionWish(userId, wishId, "complete", idempotencyKey);
}

export type {
  ConditionInput,
  CreateQuestInput,
  CreateWishInput,
  UpdateWishInput,
  WishView
} from "@growlogue/life-unlocks";
