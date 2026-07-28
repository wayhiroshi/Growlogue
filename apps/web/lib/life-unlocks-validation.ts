import { conditionMetrics, conditionOperators } from "@growlogue/life-unlocks";
import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => value || null);

export const conditionInputSchema = z
  .object({
    metric: z.enum(conditionMetrics),
    operator: z.enum(conditionOperators),
    targetValue: z.number().finite().min(0).max(1_000_000_000_000),
    baselineValue: z
      .number()
      .finite()
      .min(0)
      .max(1_000_000_000_000)
      .nullable(),
    scopeKey: optionalText(80),
    label: z.string().trim().min(1).max(80),
    unit: optionalText(20),
    currentValue: z
      .number()
      .finite()
      .min(0)
      .max(1_000_000_000_000)
      .nullable()
  })
  .superRefine((condition, context) => {
    if (condition.metric === "CATEGORY_XP" && !condition.scopeKey) {
      context.addIssue({
        code: "custom",
        path: ["scopeKey"],
        message: "カテゴリを選択してください。"
      });
    }
  });

const wishCategory = z.enum([
  "HEALTH",
  "LEARNING",
  "CAREER",
  "FINANCE",
  "FAMILY",
  "TRAVEL",
  "EXPERIENCE",
  "OTHER"
]);

export const createWishSchema = z.object({
  title: z.string().trim().min(1).max(80),
  description: optionalText(500),
  category: wishCategory,
  icon: z.string().trim().min(1).max(8),
  priority: z.number().int().min(1).max(999),
  questTitle: z.string().trim().min(1).max(100),
  rewardMessage: z.string().trim().min(1).max(500),
  conditions: z.array(conditionInputSchema).min(1).max(5)
});

export const updateWishSchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    description: optionalText(500).optional(),
    category: wishCategory.optional(),
    icon: z.string().trim().min(1).max(8).optional(),
    priority: z.number().int().min(1).max(999).optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional()
  })
  .refine((value) => Object.keys(value).length > 0);

export const createQuestSchema = z.object({
  title: z.string().trim().min(1).max(100),
  description: optionalText(500),
  conditions: z.array(conditionInputSchema).min(1).max(5)
});

export const recordFactSchema = z.object({
  conditionId: z.string().min(1).max(128),
  value: z.number().finite().min(0).max(1_000_000_000_000)
});
