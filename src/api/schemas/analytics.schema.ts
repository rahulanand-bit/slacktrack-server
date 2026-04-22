import { z } from 'zod';

const dateYmdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export const analyticsQuerySchema = z.object({
  month: monthSchema.optional(),
  from: dateYmdSchema.optional(),
  to: dateYmdSchema.optional(),
  search: z.string().trim().optional()
});

export const statusBreakdownQuerySchema = z.object({
  periodType: z.enum(['week', 'month']).default('month'),
  period: z.string().trim().optional()
});

export const analyticsPeriodQuerySchema = z.object({
  periodType: z.enum(['week', 'month']).default('month'),
  period: z.string().trim().optional()
});

export const analyticsOverviewQuerySchema = analyticsPeriodQuerySchema.extend({
  leaveThreshold: z.coerce.number().int().min(1).default(2),
  wfhRatioThresholdPct: z.coerce.number().min(0).max(100).default(70),
  minPresentDaysForWfhRatio: z.coerce.number().int().min(1).default(3)
});

export const analyticsHrInsightsQuerySchema = analyticsOverviewQuerySchema.extend({
  baselineWfoDays: z.coerce.number().int().min(1).max(7).default(3),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});
