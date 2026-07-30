import {
  calculateWishProgress,
  conditionMetrics,
  evaluateQuest,
  type CreateQuestInput,
  type CreateWishInput,
  type ConditionDefinition,
  type ConditionMetric,
  type ConditionInput,
  type MetricFact,
  type UpdateWishInput,
  type WishView
} from "@growlogue/life-unlocks";

interface WishTransitionInput {
  userId: string;
  wishId: string;
  idempotencyKey: string;
  now: Date;
}

interface WishTransitionResult {
  applied: boolean;
  eventId: string | null;
}

async function unlockWishAtomically(
  db: D1Database,
  input: WishTransitionInput
): Promise<WishTransitionResult> {
  const eventId = crypto.randomUUID();
  const timestamp = input.now.toISOString();
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO "WishEvent"
          ("id", "userId", "wishId", "eventType", "idempotencyKey", "createdAt")
         SELECT ?, ?, ?, 'UNLOCK', ?, ?
         WHERE EXISTS (
           SELECT 1 FROM "Wish"
           WHERE "id" = ? AND "userId" = ? AND "status" = 'ACTIVE'
         )
         ON CONFLICT DO NOTHING`
      )
      .bind(
        eventId,
        input.userId,
        input.wishId,
        input.idempotencyKey,
        timestamp,
        input.wishId,
        input.userId
      ),
    db
      .prepare(
        `UPDATE "Wish"
         SET "status" = 'UNLOCKED', "unlockDate" = ?, "updatedAt" = ?
         WHERE "id" = ? AND "userId" = ? AND "status" = 'ACTIVE'
           AND EXISTS (SELECT 1 FROM "WishEvent" WHERE "id" = ?)`
      )
      .bind(timestamp, timestamp, input.wishId, input.userId, eventId),
    db
      .prepare(
        `UPDATE "Reward"
         SET "unlockedAt" = ?, "updatedAt" = ?
         WHERE "wishId" = ?
           AND EXISTS (SELECT 1 FROM "WishEvent" WHERE "id" = ?)`
      )
      .bind(timestamp, timestamp, input.wishId, eventId)
  ]);
  const applied = (results[0]?.meta.changes ?? 0) === 1;
  return { applied, eventId: applied ? eventId : null };
}

async function completeWishAtomically(
  db: D1Database,
  input: WishTransitionInput
): Promise<WishTransitionResult> {
  const eventId = crypto.randomUUID();
  const timestamp = input.now.toISOString();
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO "WishEvent"
          ("id", "userId", "wishId", "eventType", "idempotencyKey", "createdAt")
         SELECT ?, ?, ?, 'COMPLETE', ?, ?
         WHERE EXISTS (
           SELECT 1 FROM "Wish"
           WHERE "id" = ? AND "userId" = ? AND "status" = 'UNLOCKED'
         )
         ON CONFLICT DO NOTHING`
      )
      .bind(
        eventId,
        input.userId,
        input.wishId,
        input.idempotencyKey,
        timestamp,
        input.wishId,
        input.userId
      ),
    db
      .prepare(
        `UPDATE "Wish"
         SET "status" = 'COMPLETED', "completedAt" = ?, "updatedAt" = ?
         WHERE "id" = ? AND "userId" = ? AND "status" = 'UNLOCKED'
           AND EXISTS (SELECT 1 FROM "WishEvent" WHERE "id" = ?)`
      )
      .bind(timestamp, timestamp, input.wishId, input.userId, eventId),
    db
      .prepare(
        `UPDATE "Reward"
         SET "completedAt" = ?, "updatedAt" = ?
         WHERE "wishId" = ?
           AND EXISTS (SELECT 1 FROM "WishEvent" WHERE "id" = ?)`
      )
      .bind(timestamp, timestamp, input.wishId, eventId)
  ]);
  const applied = (results[0]?.meta.changes ?? 0) === 1;
  return { applied, eventId: applied ? eventId : null };
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

async function loadFacts(
  db: D1Database,
  userId: string
): Promise<MetricFact[]> {
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

async function loadWishRow(
  db: D1Database,
  userId: string,
  wishId: string
) {
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

export async function listWishes(
  db: D1Database,
  userId: string
): Promise<WishView[]> {
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
    loadFacts(db, userId)
  ]);
  return assembleWishes(
    (results[0]?.results ?? []) as unknown as WishDbRow[],
    (results[1]?.results ?? []) as unknown as RewardDbRow[],
    (results[2]?.results ?? []) as unknown as QuestDbRow[],
    (results[3]?.results ?? []) as unknown as ConditionDbRow[]
  ).map((wish) => evaluateWish(wish, facts));
}

export async function getPrimaryWish(
  db: D1Database,
  userId: string
): Promise<WishView | null> {
  const wishes = await listWishes(db, userId);
  return (
    wishes.find((wish) => wish.status === "ACTIVE") ??
    wishes.find((wish) => wish.status === "UNLOCKED") ??
    null
  );
}

export async function createWish(
  db: D1Database,
  userId: string,
  input: CreateWishInput
): Promise<WishView> {
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

  const wish = await loadWishRow(db, userId, wishId);
  if (!wish) throw new Error("WISH_NOT_FOUND");
  return evaluateWish(wish, await loadFacts(db, userId));
}

export async function updateWish(
  db: D1Database,
  userId: string,
  wishId: string,
  input: UpdateWishInput
): Promise<WishView> {
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
  const wish = await loadWishRow(db, userId, wishId);
  if (!wish) throw new Error("WISH_NOT_FOUND");
  return evaluateWish(wish, await loadFacts(db, userId));
}

export async function addQuest(
  db: D1Database,
  userId: string,
  wishId: string,
  input: CreateQuestInput
): Promise<WishView> {
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

  const updated = await loadWishRow(db, userId, wishId);
  if (!updated) throw new Error("WISH_NOT_FOUND");
  return evaluateWish(updated, await loadFacts(db, userId));
}

export async function recordConditionFact(
  db: D1Database,
  userId: string,
  wishId: string,
  conditionId: string,
  value: number
): Promise<WishView> {
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
  const wish = await loadWishRow(db, userId, wishId);
  if (!wish) throw new Error("WISH_NOT_FOUND");
  return evaluateWish(wish, await loadFacts(db, userId));
}

export async function evaluateAndUnlockWish(
  db: D1Database,
  userId: string,
  wishId: string,
  idempotencyKey: string
): Promise<{ applied: boolean; wish: WishView }> {
  const wish = await loadWishRow(db, userId, wishId);
  if (!wish) throw new Error("WISH_NOT_FOUND");
  const evaluated = evaluateWish(wish, await loadFacts(db, userId));
  if (wish.status === "UNLOCKED" || wish.status === "COMPLETED") {
    return { applied: false, wish: evaluated };
  }
  if (wish.status !== "ACTIVE" || !evaluated.unlockable) {
    throw new Error("WISH_NOT_READY");
  }
  const transition = await unlockWishAtomically(db, {
    userId,
    wishId,
    idempotencyKey,
    now: new Date()
  });
  const updated = await loadWishRow(db, userId, wishId);
  if (!updated) throw new Error("WISH_NOT_FOUND");
  return {
    applied: transition.applied,
    wish: evaluateWish(updated, await loadFacts(db, userId))
  };
}

export async function completeWishReward(
  db: D1Database,
  userId: string,
  wishId: string,
  idempotencyKey: string
): Promise<{ applied: boolean; wish: WishView }> {
  const wish = await loadWishRow(db, userId, wishId);
  if (!wish) throw new Error("WISH_NOT_FOUND");
  if (wish.status === "COMPLETED") {
    return {
      applied: false,
      wish: evaluateWish(wish, await loadFacts(db, userId))
    };
  }
  if (wish.status !== "UNLOCKED") throw new Error("WISH_NOT_UNLOCKED");

  const transition = await completeWishAtomically(db, {
    userId,
    wishId,
    idempotencyKey,
    now: new Date()
  });
  const updated = await loadWishRow(db, userId, wishId);
  if (!updated) throw new Error("WISH_NOT_FOUND");
  return {
    applied: transition.applied,
    wish: evaluateWish(updated, await loadFacts(db, userId))
  };
}
