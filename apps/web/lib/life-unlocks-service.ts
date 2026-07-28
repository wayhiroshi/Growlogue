import {
  calculateWishProgress,
  conditionMetrics,
  evaluateQuest,
  type ConditionDefinition,
  type ConditionMetric,
  type ConditionOperator,
  type MetricFact
} from "@growlogue/life-unlocks";
import {
  completeWishAtomically,
  unlockWishAtomically
} from "@growlogue/db";
import { getRuntime } from "./runtime";

export interface ConditionInput {
  metric: ConditionMetric;
  operator: ConditionOperator;
  targetValue: number;
  baselineValue: number | null;
  scopeKey: string | null;
  label: string;
  unit: string | null;
  currentValue: number | null;
}

export interface CreateWishInput {
  title: string;
  description: string | null;
  category: string;
  icon: string;
  priority: number;
  questTitle: string;
  rewardMessage: string;
  conditions: ConditionInput[];
}

export interface CreateQuestInput {
  title: string;
  description: string | null;
  conditions: ConditionInput[];
}

export interface UpdateWishInput {
  title?: string | undefined;
  description?: string | null | undefined;
  category?: string | undefined;
  icon?: string | undefined;
  priority?: number | undefined;
  status?: "ACTIVE" | "ARCHIVED" | undefined;
}

function isConditionMetric(value: string): value is ConditionMetric {
  return conditionMetrics.some((metric) => metric === value);
}

function factKey(metric: ConditionMetric, scopeKey: string | null): string {
  return `${metric}:${scopeKey ?? ""}`;
}

function normalizeScope(
  input: ConditionInput,
  conditionId: string
): string | null {
  if (
    input.metric === "MANUAL_NUMBER" ||
    input.metric === "MONEY_AMOUNT"
  ) {
    return input.scopeKey?.trim() || `condition:${conditionId}`;
  }
  return input.scopeKey?.trim() || null;
}

async function loadFacts(userId: string): Promise<MetricFact[]> {
  const { db } = getRuntime();
  const results = await db.batch([
    db
      .prepare(`SELECT "totalXp" FROM "UserProgress" WHERE "userId" = ?`)
      .bind(userId),
    db
      .prepare(
        `SELECT "statusKey", "xp" FROM "StatusProgress" WHERE "userId" = ?`
      )
      .bind(userId),
    db
      .prepare(`SELECT "currentDays" FROM "Streak" WHERE "userId" = ?`)
      .bind(userId),
    db
      .prepare(
        `SELECT COUNT(*) AS "count" FROM "DailyMission"
         WHERE "userId" = ? AND "status" = 'COMPLETED'`
      )
      .bind(userId),
    db
      .prepare(
        `SELECT "metric", "scopeKey", "value" FROM "ConditionFact"
         WHERE "userId" = ? AND "metric" IN ('MANUAL_NUMBER', 'MONEY_AMOUNT')
         ORDER BY "observedAt" DESC, "createdAt" DESC`
      )
      .bind(userId)
  ]);
  const progress = results[0]?.results[0] as
    | { totalXp: number }
    | undefined;
  const statuses = (results[1]?.results ?? []) as unknown as Array<{
    statusKey: string;
    xp: number;
  }>;
  const streak = results[2]?.results[0] as
    | { currentDays: number }
    | undefined;
  const completionCount =
    ((results[3]?.results[0] as { count?: number } | undefined)?.count ?? 0);
  const manualFacts = (results[4]?.results ?? []) as unknown as Array<{
    metric: string;
    scopeKey: string | null;
    value: number;
  }>;

  const facts: MetricFact[] = [
    {
      metric: "TOTAL_XP",
      scopeKey: null,
      value: progress?.totalXp ?? 0
    },
    {
      metric: "STREAK_DAYS",
      scopeKey: null,
      value: streak?.currentDays ?? 0
    },
    {
      metric: "COMPLETION_COUNT",
      scopeKey: null,
      value: completionCount
    },
    ...statuses.map((status) => ({
      metric: "CATEGORY_XP" as const,
      scopeKey: status.statusKey,
      value: status.xp
    }))
  ];
  const seen = new Set(facts.map((fact) => factKey(fact.metric, fact.scopeKey)));
  for (const fact of manualFacts) {
    if (!isConditionMetric(fact.metric)) continue;
    const key = factKey(fact.metric, fact.scopeKey);
    if (seen.has(key)) continue;
    facts.push({
      metric: fact.metric,
      scopeKey: fact.scopeKey,
      value: fact.value
    });
    seen.add(key);
  }
  return facts;
}

function conditionDefinition(condition: {
  id: string;
  metric: string;
  operator: string;
  targetValue: number;
  baselineValue: number | null;
  scopeKey: string | null;
}): ConditionDefinition | null {
  if (!isConditionMetric(condition.metric)) return null;
  if (
    condition.operator !== "GTE" &&
    condition.operator !== "LTE" &&
    condition.operator !== "EQ"
  ) {
    return null;
  }
  return {
    id: condition.id,
    metric: condition.metric,
    operator: condition.operator,
    targetValue: condition.targetValue,
    baselineValue: condition.baselineValue,
    scopeKey: condition.scopeKey
  };
}

function lucienComment(
  status: string,
  progressPercent: number,
  unlockable: boolean
): string {
  if (status === "COMPLETED") {
    return "現実で実行されたことこそ、何より見事な報酬でございます。";
  }
  if (status === "UNLOCKED") {
    return "扉は開いております。あとは現実の一歩をお楽しみください。";
  }
  if (unlockable) {
    return "旦那様、すべての条件が整いました。扉を開きましょう。";
  }
  if (progressPercent >= 75) return "あと少しです。着実に近づいております。";
  if (progressPercent >= 40) return "物語は確かに進んでおります。";
  return "大きな願いも、今日の小さな一歩からでございます。";
}

type WishRow = Awaited<ReturnType<typeof loadWishRow>>;

interface WishDbRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  icon: string;
  priority: number;
  status: string;
  unlockDate: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface RewardDbRow {
  id: string;
  wishId: string;
  message: string;
  unlockedAt: string | null;
  completedAt: string | null;
}

interface QuestDbRow {
  id: string;
  wishId: string;
  title: string;
  description: string | null;
  position: number;
}

interface ConditionDbRow {
  id: string;
  questId: string;
  metric: string;
  operator: string;
  targetValue: number;
  baselineValue: number | null;
  scopeKey: string | null;
  label: string;
  unit: string | null;
  position: number;
}

interface WishAggregate extends WishDbRow {
  reward: RewardDbRow | null;
  quests: Array<QuestDbRow & { conditions: ConditionDbRow[] }>;
}

function assembleWishes(
  wishes: WishDbRow[],
  rewards: RewardDbRow[],
  quests: QuestDbRow[],
  conditions: ConditionDbRow[]
): WishAggregate[] {
  const conditionsByQuest = new Map<string, ConditionDbRow[]>();
  for (const condition of conditions) {
    const entries = conditionsByQuest.get(condition.questId) ?? [];
    entries.push(condition);
    conditionsByQuest.set(condition.questId, entries);
  }
  const questsByWish = new Map<
    string,
    Array<QuestDbRow & { conditions: ConditionDbRow[] }>
  >();
  for (const quest of quests) {
    const entries = questsByWish.get(quest.wishId) ?? [];
    entries.push({
      ...quest,
      conditions: conditionsByQuest.get(quest.id) ?? []
    });
    questsByWish.set(quest.wishId, entries);
  }
  const rewardByWish = new Map(rewards.map((reward) => [reward.wishId, reward]));
  return wishes.map((wish) => ({
    ...wish,
    reward: rewardByWish.get(wish.id) ?? null,
    quests: questsByWish.get(wish.id) ?? []
  }));
}

async function loadWishRow(userId: string, wishId: string) {
  const { db } = getRuntime();
  const results = await db.batch([
    db
      .prepare(
        `SELECT "id", "title", "description", "category", "icon", "priority",
                "status", "unlockDate", "completedAt", "createdAt"
         FROM "Wish" WHERE "id" = ? AND "userId" = ?`
      )
      .bind(wishId, userId),
    db
      .prepare(
        `SELECT r."id", r."wishId", r."message", r."unlockedAt", r."completedAt"
         FROM "Reward" r
         JOIN "Wish" w ON w."id" = r."wishId"
         WHERE r."wishId" = ? AND w."userId" = ?`
      )
      .bind(wishId, userId),
    db
      .prepare(
        `SELECT q."id", q."wishId", q."title", q."description", q."position"
         FROM "Quest" q
         JOIN "Wish" w ON w."id" = q."wishId"
         WHERE q."wishId" = ? AND w."userId" = ?
         ORDER BY q."position"`
      )
      .bind(wishId, userId),
    db
      .prepare(
        `SELECT c."id", c."questId", c."metric", c."operator",
                c."targetValue", c."baselineValue", c."scopeKey", c."label",
                c."unit", c."position"
         FROM "QuestCondition" c
         JOIN "Quest" q ON q."id" = c."questId"
         JOIN "Wish" w ON w."id" = q."wishId"
         WHERE q."wishId" = ? AND w."userId" = ?
         ORDER BY q."position", c."position"`
      )
      .bind(wishId, userId)
  ]);
  return (
    assembleWishes(
      (results[0]?.results ?? []) as unknown as WishDbRow[],
      (results[1]?.results ?? []) as unknown as RewardDbRow[],
      (results[2]?.results ?? []) as unknown as QuestDbRow[],
      (results[3]?.results ?? []) as unknown as ConditionDbRow[]
    )[0] ?? null
  );
}

function evaluateWish(wish: NonNullable<WishRow>, facts: readonly MetricFact[]) {
  const quests = wish.quests.map((quest) => {
    const definitions = quest.conditions
      .map(conditionDefinition)
      .filter((condition): condition is ConditionDefinition => condition !== null);
    const evaluation = evaluateQuest(definitions, facts);
    const evaluationById = new Map(
      evaluation.conditions.map((condition) => [
        condition.conditionId,
        condition
      ])
    );
    return {
      id: quest.id,
      title: quest.title,
      description: quest.description,
      position: quest.position,
      progressPercent: evaluation.progressPercent,
      completed: evaluation.completed,
      conditions: quest.conditions.map((condition) => {
        const result = evaluationById.get(condition.id);
        return {
          id: condition.id,
          metric: condition.metric,
          operator: condition.operator,
          targetValue: condition.targetValue,
          baselineValue: condition.baselineValue,
          scopeKey: condition.scopeKey,
          label: condition.label,
          unit: condition.unit,
          position: condition.position,
          currentValue: result?.currentValue ?? null,
          progressPercent: result?.progressPercent ?? 0,
          completed: result?.completed ?? false
        };
      })
    };
  });
  const computed = calculateWishProgress(quests);
  const persistedComplete =
    wish.status === "UNLOCKED" || wish.status === "COMPLETED";
  const progressPercent = persistedComplete ? 100 : computed.progressPercent;
  const unlockable = wish.status === "ACTIVE" && computed.completed;

  return {
    id: wish.id,
    title: wish.title,
    description: wish.description,
    category: wish.category,
    icon: wish.icon,
    priority: wish.priority,
    status: wish.status,
    unlockDate: wish.unlockDate,
    completedAt: wish.completedAt,
    progressPercent,
    unlockable,
    lucienComment: lucienComment(
      wish.status,
      progressPercent,
      unlockable
    ),
    reward: wish.reward
      ? {
          id: wish.reward.id,
          message: wish.reward.message,
          unlockedAt: wish.reward.unlockedAt,
          completedAt: wish.reward.completedAt
        }
      : null,
    quests
  };
}

export type WishView = ReturnType<typeof evaluateWish>;

export async function listWishes(userId: string): Promise<WishView[]> {
  const { db } = getRuntime();
  const [results, facts] = await Promise.all([
    db.batch([
      db
        .prepare(
          `SELECT "id", "title", "description", "category", "icon", "priority",
                  "status", "unlockDate", "completedAt", "createdAt"
           FROM "Wish" WHERE "userId" = ? AND "status" != 'ARCHIVED'
           ORDER BY "priority", "createdAt"`
        )
        .bind(userId),
      db
        .prepare(
          `SELECT r."id", r."wishId", r."message", r."unlockedAt", r."completedAt"
           FROM "Reward" r JOIN "Wish" w ON w."id" = r."wishId"
           WHERE w."userId" = ? AND w."status" != 'ARCHIVED'`
        )
        .bind(userId),
      db
        .prepare(
          `SELECT q."id", q."wishId", q."title", q."description", q."position"
           FROM "Quest" q JOIN "Wish" w ON w."id" = q."wishId"
           WHERE w."userId" = ? AND w."status" != 'ARCHIVED'
           ORDER BY q."position"`
        )
        .bind(userId),
      db
        .prepare(
          `SELECT c."id", c."questId", c."metric", c."operator",
                  c."targetValue", c."baselineValue", c."scopeKey", c."label",
                  c."unit", c."position"
           FROM "QuestCondition" c
           JOIN "Quest" q ON q."id" = c."questId"
           JOIN "Wish" w ON w."id" = q."wishId"
           WHERE w."userId" = ? AND w."status" != 'ARCHIVED'
           ORDER BY q."position", c."position"`
        )
        .bind(userId)
    ]),
    loadFacts(userId)
  ]);
  return assembleWishes(
    (results[0]?.results ?? []) as unknown as WishDbRow[],
    (results[1]?.results ?? []) as unknown as RewardDbRow[],
    (results[2]?.results ?? []) as unknown as QuestDbRow[],
    (results[3]?.results ?? []) as unknown as ConditionDbRow[]
  ).map((wish) => evaluateWish(wish, facts));
}

export async function getPrimaryWish(userId: string): Promise<WishView | null> {
  const wishes = await listWishes(userId);
  return (
    wishes.find((wish) => wish.status === "ACTIVE") ??
    wishes.find((wish) => wish.status === "UNLOCKED") ??
    null
  );
}

export async function createWish(
  userId: string,
  input: CreateWishInput
): Promise<WishView> {
  const { db } = getRuntime();
  const wishId = crypto.randomUUID();
  const questId = crypto.randomUUID();
  const rewardId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO "Wish"
          ("id", "userId", "title", "description", "category", "icon",
           "priority", "status", "createdAt", "updatedAt")
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`
      )
      .bind(
        wishId,
        userId,
        input.title,
        input.description,
        input.category,
        input.icon,
        input.priority,
        timestamp,
        timestamp
      ),
    db
      .prepare(
        `INSERT INTO "Quest"
          ("id", "wishId", "title", "position", "conditionLogic", "createdAt", "updatedAt")
         VALUES (?, ?, ?, 1, 'ALL', ?, ?)`
      )
      .bind(questId, wishId, input.questTitle, timestamp, timestamp),
    db
      .prepare(
        `INSERT INTO "Reward"
          ("id", "wishId", "rewardType", "message", "createdAt", "updatedAt")
         VALUES (?, ?, 'REAL_WORLD', ?, ?, ?)`
      )
      .bind(rewardId, wishId, input.rewardMessage, timestamp, timestamp)
  ];

  input.conditions.forEach((condition, index) => {
    const conditionId = crypto.randomUUID();
    const scopeKey = normalizeScope(condition, conditionId);
    statements.push(
      db
        .prepare(
          `INSERT INTO "QuestCondition"
            ("id", "questId", "metric", "operator", "targetValue",
             "baselineValue", "scopeKey", "label", "unit", "position",
             "createdAt", "updatedAt")
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          conditionId,
          questId,
          condition.metric,
          condition.operator,
          condition.targetValue,
          condition.baselineValue,
          scopeKey,
          condition.label,
          condition.unit,
          index + 1,
          timestamp,
          timestamp
        )
    );
    if (
      condition.currentValue !== null &&
      (condition.metric === "MANUAL_NUMBER" ||
        condition.metric === "MONEY_AMOUNT")
    ) {
      statements.push(
        db
          .prepare(
            `INSERT INTO "ConditionFact"
              ("id", "userId", "metric", "scopeKey", "value", "unit",
               "observedAt", "createdAt")
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            userId,
            condition.metric,
            scopeKey,
            condition.currentValue,
            condition.unit,
            timestamp,
            timestamp
          )
      );
    }
  });
  await db.batch(statements);

  const wish = await loadWishRow(userId, wishId);
  if (!wish) throw new Error("WISH_NOT_FOUND");
  return evaluateWish(wish, await loadFacts(userId));
}

export async function updateWish(
  userId: string,
  wishId: string,
  input: UpdateWishInput
): Promise<WishView> {
  const { db } = getRuntime();
  const assignments: string[] = [];
  const values: unknown[] = [];
  const add = (column: string, value: unknown) => {
    assignments.push(`"${column}" = ?`);
    values.push(value);
  };
  if (input.title !== undefined) add("title", input.title);
  if (input.description !== undefined) add("description", input.description);
  if (input.category !== undefined) add("category", input.category);
  if (input.icon !== undefined) add("icon", input.icon);
  if (input.priority !== undefined) add("priority", input.priority);
  if (input.status !== undefined) add("status", input.status);
  add("updatedAt", new Date().toISOString());
  const result = await db
    .prepare(
      `UPDATE "Wish" SET ${assignments.join(", ")}
       WHERE "id" = ? AND "userId" = ?
       ${input.status !== undefined ? `AND "status" IN ('ACTIVE', 'ARCHIVED')` : ""}`
    )
    .bind(...values, wishId, userId)
    .run();
  if ((result.meta.changes ?? 0) !== 1) throw new Error("WISH_NOT_FOUND");
  const wish = await loadWishRow(userId, wishId);
  if (!wish) throw new Error("WISH_NOT_FOUND");
  return evaluateWish(wish, await loadFacts(userId));
}

export async function addQuest(
  userId: string,
  wishId: string,
  input: CreateQuestInput
): Promise<WishView> {
  const { db } = getRuntime();
  const wish = await db
    .prepare(
      `SELECT w."id", COUNT(q."id") AS "questCount"
       FROM "Wish" w LEFT JOIN "Quest" q ON q."wishId" = w."id"
       WHERE w."id" = ? AND w."userId" = ? AND w."status" = 'ACTIVE'
       GROUP BY w."id"`
    )
    .bind(wishId, userId)
    .first<{ id: string; questCount: number }>();
  if (!wish) throw new Error("WISH_NOT_FOUND");

  const questId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO "Quest"
          ("id", "wishId", "title", "description", "position",
           "conditionLogic", "createdAt", "updatedAt")
         VALUES (?, ?, ?, ?, ?, 'ALL', ?, ?)`
      )
      .bind(
        questId,
        wishId,
        input.title,
        input.description,
        wish.questCount + 1,
        timestamp,
        timestamp
      )
  ];
  input.conditions.forEach((condition, index) => {
    const conditionId = crypto.randomUUID();
    const scopeKey = normalizeScope(condition, conditionId);
    statements.push(
      db
        .prepare(
          `INSERT INTO "QuestCondition"
            ("id", "questId", "metric", "operator", "targetValue",
             "baselineValue", "scopeKey", "label", "unit", "position",
             "createdAt", "updatedAt")
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          conditionId,
          questId,
          condition.metric,
          condition.operator,
          condition.targetValue,
          condition.baselineValue,
          scopeKey,
          condition.label,
          condition.unit,
          index + 1,
          timestamp,
          timestamp
        )
    );
    if (
      condition.currentValue !== null &&
      (condition.metric === "MANUAL_NUMBER" ||
        condition.metric === "MONEY_AMOUNT")
    ) {
      statements.push(
        db
          .prepare(
            `INSERT INTO "ConditionFact"
              ("id", "userId", "metric", "scopeKey", "value", "unit",
               "observedAt", "createdAt")
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            userId,
            condition.metric,
            scopeKey,
            condition.currentValue,
            condition.unit,
            timestamp,
            timestamp
          )
      );
    }
  });
  await db.batch(statements);

  const updated = await loadWishRow(userId, wishId);
  if (!updated) throw new Error("WISH_NOT_FOUND");
  return evaluateWish(updated, await loadFacts(userId));
}

export async function recordConditionFact(
  userId: string,
  wishId: string,
  conditionId: string,
  value: number
): Promise<WishView> {
  const { db } = getRuntime();
  const condition = await db
    .prepare(
      `SELECT c."metric", c."scopeKey", c."unit"
       FROM "QuestCondition" c
       JOIN "Quest" q ON q."id" = c."questId"
       JOIN "Wish" w ON w."id" = q."wishId"
       WHERE c."id" = ? AND w."id" = ? AND w."userId" = ?
         AND w."status" = 'ACTIVE'`
    )
    .bind(conditionId, wishId, userId)
    .first<{ metric: string; scopeKey: string | null; unit: string | null }>();
  if (!condition) throw new Error("CONDITION_NOT_FOUND");
  if (
    condition.metric !== "MANUAL_NUMBER" &&
    condition.metric !== "MONEY_AMOUNT"
  ) {
    throw new Error("CONDITION_NOT_MANUAL");
  }
  const timestamp = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO "ConditionFact"
        ("id", "userId", "metric", "scopeKey", "value", "unit",
         "observedAt", "createdAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      userId,
      condition.metric,
      condition.scopeKey,
      value,
      condition.unit,
      timestamp,
      timestamp
    )
    .run();
  const wish = await loadWishRow(userId, wishId);
  if (!wish) throw new Error("WISH_NOT_FOUND");
  return evaluateWish(wish, await loadFacts(userId));
}

export async function evaluateAndUnlockWish(
  userId: string,
  wishId: string,
  idempotencyKey: string
): Promise<{ applied: boolean; wish: WishView }> {
  const wish = await loadWishRow(userId, wishId);
  if (!wish) throw new Error("WISH_NOT_FOUND");
  const evaluated = evaluateWish(wish, await loadFacts(userId));
  if (wish.status === "UNLOCKED" || wish.status === "COMPLETED") {
    return { applied: false, wish: evaluated };
  }
  if (wish.status !== "ACTIVE" || !evaluated.unlockable) {
    throw new Error("WISH_NOT_READY");
  }
  const transition = await unlockWishAtomically(getRuntime().db, {
    userId,
    wishId,
    idempotencyKey,
    now: new Date()
  });
  const updated = await loadWishRow(userId, wishId);
  if (!updated) throw new Error("WISH_NOT_FOUND");
  return {
    applied: transition.applied,
    wish: evaluateWish(updated, await loadFacts(userId))
  };
}

export async function completeWishReward(
  userId: string,
  wishId: string,
  idempotencyKey: string
): Promise<{ applied: boolean; wish: WishView }> {
  const wish = await loadWishRow(userId, wishId);
  if (!wish) throw new Error("WISH_NOT_FOUND");
  if (wish.status === "COMPLETED") {
    return {
      applied: false,
      wish: evaluateWish(wish, await loadFacts(userId))
    };
  }
  if (wish.status !== "UNLOCKED") throw new Error("WISH_NOT_UNLOCKED");

  const transition = await completeWishAtomically(getRuntime().db, {
    userId,
    wishId,
    idempotencyKey,
    now: new Date()
  });
  const updated = await loadWishRow(userId, wishId);
  if (!updated) throw new Error("WISH_NOT_FOUND");
  return {
    applied: transition.applied,
    wish: evaluateWish(updated, await loadFacts(userId))
  };
}
