import { z } from 'zod';

export const attendanceQuerySchema = z.object({
  dateYmd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
});

export const attendanceMonthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional()
});

export const attendanceRangeQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});
