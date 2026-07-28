import { describe, expect, it } from "vitest";
import {
  conditionInputSchema,
  createWishSchema
} from "../lib/life-unlocks-validation";

describe("web app", () => {
  it("uses the canonical product brand", () => {
    expect("Growlogue").toMatch(/^Growlogue$/);
  });

  it("requires at least one valid Life Unlocks condition", () => {
    const result = createWishSchema.safeParse({
      title: "北海道旅行",
      description: null,
      category: "TRAVEL",
      icon: "✈️",
      priority: 100,
      questTitle: "旅の準備",
      rewardMessage: "北海道へ出発する",
      conditions: []
    });
    expect(result.success).toBe(false);
  });

  it("requires a scope for category XP", () => {
    const result = conditionInputSchema.safeParse({
      metric: "CATEGORY_XP",
      operator: "GTE",
      targetValue: 100,
      baselineValue: null,
      scopeKey: null,
      label: "健康XP",
      unit: "XP",
      currentValue: null
    });
    expect(result.success).toBe(false);
  });
});
