import type { Request, Response } from 'express';
import {
  analyticsHrInsightsQuerySchema,
  analyticsOverviewQuerySchema,
  analyticsPeriodQuerySchema,
  analyticsQuerySchema,
  statusBreakdownQuerySchema
} from '../schemas/analytics.schema';
import type { AnalyticsService } from '../services/analytics.service';

export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  async getOverview(req: Request, res: Response): Promise<void> {
    const query = analyticsOverviewQuerySchema.parse(req.query);
    const periodError = this.getPeriodValidationError(query.periodType, query.period);
    if (periodError) {
      res.status(400).json({ ok: false, error: periodError });
      return;
    }
    const data = await this.analyticsService.getOverview(query);
    res.status(200).json({ ok: true, data });
  }

  async getCharts(req: Request, res: Response): Promise<void> {
    const query = analyticsPeriodQuerySchema.parse(req.query);
    const periodError = this.getPeriodValidationError(query.periodType, query.period);
    if (periodError) {
      res.status(400).json({ ok: false, error: periodError });
      return;
    }
    const data = await this.analyticsService.getCharts(query);
    res.status(200).json({ ok: true, data });
  }

  async getTrend(req: Request, res: Response): Promise<void> {
    const query = analyticsPeriodQuerySchema.parse(req.query);
    const periodError = this.getPeriodValidationError(query.periodType, query.period);
    if (periodError) {
      res.status(400).json({ ok: false, error: periodError });
      return;
    }
    const data = await this.analyticsService.getTrend(query);
    res.status(200).json({ ok: true, data });
  }

  async getHrInsights(req: Request, res: Response): Promise<void> {
    const query = analyticsHrInsightsQuerySchema.parse(req.query);
    const periodError = this.getPeriodValidationError(query.periodType, query.period);
    if (periodError) {
      res.status(400).json({ ok: false, error: periodError });
      return;
    }
    const data = await this.analyticsService.getHrInsights(query);
    res.status(200).json({ ok: true, data });
  }

  async getFinanceProjectContribution(req: Request, res: Response): Promise<void> {
    const query = analyticsPeriodQuerySchema.parse(req.query);
    const periodError = this.getPeriodValidationError(query.periodType, query.period);
    if (periodError) {
      res.status(400).json({ ok: false, error: periodError });
      return;
    }
    const data = await this.analyticsService.getFinanceProjectContribution(query);
    res.status(200).json({ ok: true, data });
  }

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

  async listStatusBreakdown(req: Request, res: Response): Promise<void> {
    const query = statusBreakdownQuerySchema.parse(req.query);
    const periodError = this.getPeriodValidationError(query.periodType, query.period);
    if (periodError) {
      res.status(400).json({ ok: false, error: periodError });
      return;
    }
    const data = await this.analyticsService.listStatusBreakdownByPeriod(query);
    res.status(200).json({ ok: true, data });
  }

  private getPeriodValidationError(periodType: 'week' | 'month', period?: string): string | null {
    if (periodType === 'week' && period && !/^\d{4}-\d{2}-\d{2}$/.test(period)) {
      return 'Invalid period format. Expected YYYY-MM-DD for weekly filter.';
    }
    if (periodType === 'month' && period && !/^\d{4}-\d{2}$/.test(period)) {
      return 'Invalid period format. Expected YYYY-MM for monthly filter.';
    }
    return null;
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
