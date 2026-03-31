import type { Request, Response } from 'express';
import { attendanceMonthQuerySchema } from '../schemas/attendance-admin.schema';
import type { AnalyticsService } from '../services/analytics.service';

export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  async listProjectMonthlyUserStats(req: Request, res: Response): Promise<void> {
    const { month } = attendanceMonthQuerySchema.parse(req.query);
    const data = await this.analyticsService.listProjectMonthlyUserStats(month);
    res.status(200).json({ ok: true, data });
  }

  async listUserProjectMonthlyStats(req: Request, res: Response): Promise<void> {
    const slackUserId = String(req.params.slackUserId || '').trim();
    if (!slackUserId) {
      res.status(400).json({ ok: false, error: 'Invalid slack user id' });
      return;
    }

    const { month } = attendanceMonthQuerySchema.parse(req.query);
    const data = await this.analyticsService.listUserProjectMonthlyStats(slackUserId, month);
    res.status(200).json({ ok: true, data });
  }
}
