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
  const { prisma } = getRuntime();
  const [progress, statuses, streak, completionCount, manualFacts] =
    await Promise.all([
      prisma.userProgress.findUnique({
        where: { userId },
        select: { totalXp: true }
      }),
      prisma.statusProgress.findMany({
        where: { userId },
        select: { statusKey: true, xp: true }
      }),
      prisma.streak.findUnique({
        where: { userId },
        select: { currentDays: true }
      }),
      prisma.dailyMission.count({
        where: { userId, status: "COMPLETED" }
      }),
      prisma.conditionFact.findMany({
        where: {
          userId,
          metric: { in: ["MANUAL_NUMBER", "MONEY_AMOUNT"] }
        },
        orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }]
      })
    ]);

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

async function loadWishRow(userId: string, wishId: string) {
  return getRuntime().prisma.wish.findFirst({
    where: { id: wishId, userId },
    include: {
      reward: true,
      quests: {
        include: {
          conditions: { orderBy: { position: "asc" } }
        },
        orderBy: { position: "asc" }
      }
    }
  });
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
    unlockDate: wish.unlockDate?.toISOString() ?? null,
    completedAt: wish.completedAt?.toISOString() ?? null,
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
          unlockedAt: wish.reward.unlockedAt?.toISOString() ?? null,
          completedAt: wish.reward.completedAt?.toISOString() ?? null
        }
      : null,
    quests
  };
}

export type WishView = ReturnType<typeof evaluateWish>;

export async function listWishes(userId: string): Promise<WishView[]> {
  const { prisma } = getRuntime();
  const [wishes, facts] = await Promise.all([
    prisma.wish.findMany({
      where: { userId, status: { not: "ARCHIVED" } },
      include: {
        reward: true,
        quests: {
          include: {
            conditions: { orderBy: { position: "asc" } }
          },
          orderBy: { position: "asc" }
        }
      },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }]
    }),
    loadFacts(userId)
  ]);
  return wishes.map((wish) => evaluateWish(wish, facts));
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
  const { prisma } = getRuntime();
  const data = {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.icon !== undefined ? { icon: input.icon } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.status !== undefined ? { status: input.status } : {})
  };
  const result = await prisma.wish.updateMany({
    where: {
      id: wishId,
      userId,
      ...(input.status !== undefined
        ? { status: { in: ["ACTIVE", "ARCHIVED"] } }
        : {})
    },
    data
  });
  if (result.count !== 1) throw new Error("WISH_NOT_FOUND");
  const wish = await loadWishRow(userId, wishId);
  if (!wish) throw new Error("WISH_NOT_FOUND");
  return evaluateWish(wish, await loadFacts(userId));
}

export async function addQuest(
  userId: string,
  wishId: string,
  input: CreateQuestInput
): Promise<WishView> {
  const { db, prisma } = getRuntime();
  const wish = await prisma.wish.findFirst({
    where: { id: wishId, userId, status: "ACTIVE" },
    include: { _count: { select: { quests: true } } }
  });
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
        wish._count.quests + 1,
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
  const { prisma } = getRuntime();
  const condition = await prisma.questCondition.findFirst({
    where: {
      id: conditionId,
      quest: { wish: { id: wishId, userId, status: "ACTIVE" } }
    }
  });
  if (!condition) throw new Error("CONDITION_NOT_FOUND");
  if (
    condition.metric !== "MANUAL_NUMBER" &&
    condition.metric !== "MONEY_AMOUNT"
  ) {
    throw new Error("CONDITION_NOT_MANUAL");
  }
  await prisma.conditionFact.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      metric: condition.metric,
      scopeKey: condition.scopeKey,
      value,
      unit: condition.unit,
      observedAt: new Date()
    }
  });
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
