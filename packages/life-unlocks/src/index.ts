export const conditionMetrics = [
  "TOTAL_XP",
  "CATEGORY_XP",
  "STREAK_DAYS",
  "COMPLETION_COUNT",
  "MANUAL_NUMBER",
  "MONEY_AMOUNT"
] as const;

export const conditionOperators = ["GTE", "LTE", "EQ"] as const;

export type ConditionMetric = (typeof conditionMetrics)[number];
export type ConditionOperator = (typeof conditionOperators)[number];
export type ConditionLogic = "ALL";

export interface MetricFact {
  metric: ConditionMetric;
  scopeKey: string | null;
  value: number;
}

export interface ConditionDefinition {
  id: string;
  metric: ConditionMetric;
  operator: ConditionOperator;
  targetValue: number;
  baselineValue: number | null;
  scopeKey: string | null;
}

export interface ConditionEvaluation {
  conditionId: string;
  currentValue: number | null;
  targetValue: number;
  progressPercent: number;
  completed: boolean;
}

export interface QuestEvaluation {
  conditions: ConditionEvaluation[];
  progressPercent: number;
  completed: boolean;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function sameScope(left: string | null, right: string | null): boolean {
  return left === right;
}

function calculateProgress(
  condition: ConditionDefinition,
  currentValue: number
): number {
  if (condition.operator === "EQ") {
    return currentValue === condition.targetValue ? 100 : 0;
  }

  if (condition.operator === "GTE") {
    if (currentValue >= condition.targetValue) return 100;
    if (
      condition.baselineValue !== null &&
      condition.targetValue > condition.baselineValue
    ) {
      return clampPercent(
        ((currentValue - condition.baselineValue) /
          (condition.targetValue - condition.baselineValue)) *
          100
      );
    }
    if (condition.targetValue <= 0) return 0;
    return clampPercent((currentValue / condition.targetValue) * 100);
  }

  if (currentValue <= condition.targetValue) return 100;
  if (
    condition.baselineValue !== null &&
    condition.baselineValue > condition.targetValue
  ) {
    return clampPercent(
      ((condition.baselineValue - currentValue) /
        (condition.baselineValue - condition.targetValue)) *
        100
    );
  }
  return 0;
}

export function evaluateCondition(
  condition: ConditionDefinition,
  facts: readonly MetricFact[]
): ConditionEvaluation {
  const fact = facts.find(
    (candidate) =>
      candidate.metric === condition.metric &&
      sameScope(candidate.scopeKey, condition.scopeKey)
  );
  if (!fact || !Number.isFinite(fact.value)) {
    return {
      conditionId: condition.id,
      currentValue: null,
      targetValue: condition.targetValue,
      progressPercent: 0,
      completed: false
    };
  }

  const completed =
    condition.operator === "GTE"
      ? fact.value >= condition.targetValue
      : condition.operator === "LTE"
        ? fact.value <= condition.targetValue
        : fact.value === condition.targetValue;

  return {
    conditionId: condition.id,
    currentValue: fact.value,
    targetValue: condition.targetValue,
    progressPercent: calculateProgress(condition, fact.value),
    completed
  };
}

export function evaluateQuest(
  conditions: readonly ConditionDefinition[],
  facts: readonly MetricFact[],
  logic: ConditionLogic = "ALL"
): QuestEvaluation {
  const evaluations = conditions.map((condition) =>
    evaluateCondition(condition, facts)
  );
  if (evaluations.length === 0) {
    return { conditions: [], progressPercent: 0, completed: false };
  }

  const completed =
    logic === "ALL" && evaluations.every((condition) => condition.completed);
  const progressPercent = Math.round(
    evaluations.reduce(
      (total, condition) => total + condition.progressPercent,
      0
    ) / evaluations.length
  );

  return { conditions: evaluations, progressPercent, completed };
}

export function calculateWishProgress(
  quests: readonly Pick<QuestEvaluation, "progressPercent" | "completed">[]
): { progressPercent: number; completed: boolean } {
  if (quests.length === 0) return { progressPercent: 0, completed: false };
  return {
    progressPercent: Math.round(
      quests.reduce((total, quest) => total + quest.progressPercent, 0) /
        quests.length
    ),
    completed: quests.every((quest) => quest.completed)
  };
}
