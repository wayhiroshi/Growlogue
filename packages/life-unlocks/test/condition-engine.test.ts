import { describe, expect, it } from "vitest";
import {
  calculateWishProgress,
  evaluateCondition,
  evaluateQuest,
  type ConditionDefinition,
  type MetricFact
} from "../src/index";

function condition(
  overrides: Partial<ConditionDefinition> = {}
): ConditionDefinition {
  return {
    id: "condition-1",
    metric: "TOTAL_XP",
    operator: "GTE",
    targetValue: 100,
    baselineValue: null,
    scopeKey: null,
    ...overrides
  };
}

const totalXpFact: MetricFact = {
  metric: "TOTAL_XP",
  scopeKey: null,
  value: 72
};

describe("Life Unlocks condition engine", () => {
  it("treats a missing fact as incomplete", () => {
    expect(evaluateCondition(condition(), [])).toMatchObject({
      currentValue: null,
      progressPercent: 0,
      completed: false
    });
  });

  it("calculates GTE progress without a baseline", () => {
    expect(evaluateCondition(condition(), [totalXpFact])).toMatchObject({
      currentValue: 72,
      progressPercent: 72,
      completed: false
    });
  });

  it("calculates GTE progress from a baseline", () => {
    expect(
      evaluateCondition(
        condition({ baselineValue: 50, targetValue: 100 }),
        [{ ...totalXpFact, value: 75 }]
      )
    ).toMatchObject({ progressPercent: 50, completed: false });
  });

  it("calculates LTE progress from a baseline", () => {
    expect(
      evaluateCondition(
        condition({
          metric: "MANUAL_NUMBER",
          operator: "LTE",
          baselineValue: 80,
          targetValue: 70,
          scopeKey: "body_weight"
        }),
        [{ metric: "MANUAL_NUMBER", scopeKey: "body_weight", value: 75 }]
      )
    ).toMatchObject({ progressPercent: 50, completed: false });
  });

  it("does not complete an LTE condition without a fact", () => {
    expect(
      evaluateCondition(
        condition({ operator: "LTE", targetValue: 72 }),
        []
      ).completed
    ).toBe(false);
  });

  it("matches category facts by scope", () => {
    const result = evaluateCondition(
      condition({
        metric: "CATEGORY_XP",
        scopeKey: "health",
        targetValue: 50
      }),
      [
        { metric: "CATEGORY_XP", scopeKey: "writing", value: 100 },
        { metric: "CATEGORY_XP", scopeKey: "health", value: 50 }
      ]
    );
    expect(result.completed).toBe(true);
  });

  it("requires every condition for an ALL quest", () => {
    const result = evaluateQuest(
      [
        condition(),
        condition({
          id: "condition-2",
          metric: "STREAK_DAYS",
          targetValue: 3
        })
      ],
      [
        { ...totalXpFact, value: 100 },
        { metric: "STREAK_DAYS", scopeKey: null, value: 2 }
      ]
    );
    expect(result).toMatchObject({ progressPercent: 84, completed: false });
  });

  it("averages quest progress and requires all quests", () => {
    expect(
      calculateWishProgress([
        { progressPercent: 100, completed: true },
        { progressPercent: 50, completed: false }
      ])
    ).toEqual({ progressPercent: 75, completed: false });
  });
});
