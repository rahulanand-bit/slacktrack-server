import type { Request, Response } from 'express';
import type { DashboardService } from '../services/dashboard.service';

export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  async getSummary(_req: Request, res: Response): Promise<void> {
    const summary = await this.dashboardService.getSummary();
    res.status(200).json({ ok: true, data: summary });
  }
}
