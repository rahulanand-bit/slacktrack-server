import type { Request, Response } from 'express';
import { analyticsQuerySchema } from '../schemas/analytics.schema';
import type { AnalyticsService } from '../services/analytics.service';

export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  async listProjectMonthlyUserStats(req: Request, res: Response): Promise<void> {
    const query = this.parseAnalyticsQuery(req);
    const data = await this.analyticsService.listProjectMonthlyUserStats(query);
    res.status(200).json({ ok: true, data });
  }

  async listEmployeeSummaryStats(req: Request, res: Response): Promise<void> {
    const query = this.parseAnalyticsQuery(req);
    const data = await this.analyticsService.listEmployeeSummaryStats(query);
    res.status(200).json({ ok: true, data });
  }

  async listProjectSummaryStats(req: Request, res: Response): Promise<void> {
    const query = this.parseAnalyticsQuery(req);
    const data = await this.analyticsService.listProjectSummaryStats(query);
    res.status(200).json({ ok: true, data });
  }

  async listUserProjectMonthlyStats(req: Request, res: Response): Promise<void> {
    const slackUserId = String(req.params.slackUserId || '').trim();
    if (!slackUserId) {
      res.status(400).json({ ok: false, error: 'Invalid slack user id' });
      return;
    }

    const query = this.parseAnalyticsQuery(req);
    const data = await this.analyticsService.listUserProjectMonthlyStats(slackUserId, query);
    res.status(200).json({ ok: true, data });
  }

  async listProjectUsersStats(req: Request, res: Response): Promise<void> {
    const projectName = decodeURIComponent(String(req.params.projectName || '').trim());
    if (!projectName) {
      res.status(400).json({ ok: false, error: 'Invalid project name' });
      return;
    }

    const query = this.parseAnalyticsQuery(req);
    const data = await this.analyticsService.listProjectUsersStats(projectName, query);
    res.status(200).json({ ok: true, data });
  }

  private parseAnalyticsQuery(req: Request): {
    month?: string;
    from?: string;
    to?: string;
    slackUserIds?: string[];
    projectNames?: string[];
    search?: string;
  } {
    const base = analyticsQuerySchema.parse(req.query);
    return {
      ...base,
      slackUserIds: this.parseCsv(req.query.slackUserIds),
      projectNames: this.parseCsv(req.query.projects)
    };
  }

  private parseCsv(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .flatMap((entry) => String(entry).split(','))
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    if (typeof value === 'string') {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    return [];
  }
}
