import { z } from 'zod';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

export const createTimerSchema = z.object({
  name: z.string().min(1),
  timerType: z.enum(['morning', 'evening', 'custom']),
  cronExpression: z.string().min(5).optional(),
  time: timeSchema.optional(),
  timezone: z.string().min(1),
  active: z.boolean().default(true)
}).refine((value) => Boolean(value.cronExpression || value.time), {
  message: 'Either cronExpression or time is required'
});

export const updateTimerSchema = z.object({
  name: z.string().min(1).optional(),
  timerType: z.enum(['morning', 'evening', 'custom']).optional(),
  cronExpression: z.string().min(5).optional(),
  time: timeSchema.optional(),
  timezone: z.string().min(1).optional(),
  active: z.boolean().optional()
});

export const manualAttendanceReminderSchema = z.object({
  slackUserIds: z.array(z.string().trim().min(1)).max(200).optional()
});
