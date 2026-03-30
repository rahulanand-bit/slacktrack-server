import { z } from 'zod';

export const attendanceOverrideSchema = z.object({
  slackUserId: z.string().min(1),
  dateYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['WFO', 'WFH', '-1', '-0.5'])
});

export const projectsOverrideSchema = z.object({
  slackUserId: z.string().min(1),
  dateYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  projects: z.array(z.string()).max(3)
});
