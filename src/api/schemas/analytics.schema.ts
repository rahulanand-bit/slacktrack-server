import { z } from 'zod';

const dateYmdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export const analyticsQuerySchema = z.object({
  month: monthSchema.optional(),
  from: dateYmdSchema.optional(),
  to: dateYmdSchema.optional(),
  search: z.string().trim().optional()
});
