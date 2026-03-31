import { z } from 'zod';

const dateYmdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const holidayEntrySchema = z.object({
  dateYmd: dateYmdSchema,
  holidayName: z.string().trim().min(1).max(120)
});

export const replaceHolidaysSchema = z.object({
  holidays: z.array(holidayEntrySchema).max(366)
});
