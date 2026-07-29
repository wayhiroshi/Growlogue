import { z } from "zod";
import { isGameDate, startOfIsoWeek } from "./weekly-report-domain";

const mondaySchema = z
  .string()
  .refine(
    (value) => isGameDate(value) && startOfIsoWeek(value) === value,
    "週の開始日は月曜日を指定してください。"
  );

export const createShareCardSchema = z.object({
  weekStart: mondaySchema,
  expiresInDays: z.union([z.literal(1), z.literal(7), z.literal(30)]),
  includeCategoryXp: z.boolean(),
  includeStreak: z.boolean()
});

export const shareCardWeekSchema = mondaySchema;
