import { z } from 'zod';

export const dashboardSummaryQuerySchema = z.object({
  dateYmd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
});

export const dashboardPeriodQuerySchema = z.object({
  periodType: z.enum(['week', 'month']).default('month'),
  period: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional()
});
