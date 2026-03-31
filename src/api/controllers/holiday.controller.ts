import type { Request, Response } from 'express';
import { replaceHolidaysSchema } from '../schemas/holiday.schema';
import type { HolidayService } from '../services/holiday.service';

export class HolidayController {
  constructor(private readonly holidayService: HolidayService) {}

  async listHolidays(_req: Request, res: Response): Promise<void> {
    const holidays = await this.holidayService.listHolidays();
    res.status(200).json({ ok: true, data: holidays });
  }

  async replaceHolidays(req: Request, res: Response): Promise<void> {
    const input = replaceHolidaysSchema.parse(req.body || {});
    const holidays = await this.holidayService.replaceHolidays(input.holidays);
    res.status(200).json({ ok: true, data: holidays });
  }
}
