import type { Request, Response } from 'express';
import { dashboardPeriodQuerySchema, dashboardSummaryQuerySchema } from '../schemas/dashboard.schema';
import type { DashboardService } from '../services/dashboard.service';

export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  async getSummary(req: Request, res: Response): Promise<void> {
    const { dateYmd } = dashboardSummaryQuerySchema.parse(req.query);
    const summary = await this.dashboardService.getSummary(dateYmd);
    res.status(200).json({ ok: true, data: summary });
  }

  async getProjectwise(req: Request, res: Response): Promise<void> {
    const input = dashboardPeriodQuerySchema.parse(req.query);
    if (input.periodType === 'week' && input.period && !/^\d{4}-\d{2}-\d{2}$/.test(input.period)) {
      res.status(400).json({ ok: false, error: 'Invalid period format. Expected YYYY-MM-DD for weekly filter.' });
      return;
    }
    if (input.periodType === 'month' && input.period && !/^\d{4}-\d{2}$/.test(input.period)) {
      res.status(400).json({ ok: false, error: 'Invalid period format. Expected YYYY-MM for monthly filter.' });
      return;
    }
    const data = await this.dashboardService.getProjectwise(input);
    res.status(200).json({ ok: true, data });
  }

  async getEmployeewise(req: Request, res: Response): Promise<void> {
    const input = dashboardPeriodQuerySchema.parse(req.query);
    if (input.periodType === 'week' && input.period && !/^\d{4}-\d{2}-\d{2}$/.test(input.period)) {
      res.status(400).json({ ok: false, error: 'Invalid period format. Expected YYYY-MM-DD for weekly filter.' });
      return;
    }
    if (input.periodType === 'month' && input.period && !/^\d{4}-\d{2}$/.test(input.period)) {
      res.status(400).json({ ok: false, error: 'Invalid period format. Expected YYYY-MM for monthly filter.' });
      return;
    }
    const data = await this.dashboardService.getEmployeewise(input);
    res.status(200).json({ ok: true, data });
  }
}
