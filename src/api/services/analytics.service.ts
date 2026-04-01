import { DateTime } from 'luxon';
import { env } from '../../config/env';
import type { AnalyticsQueryFilters, AnalyticsRepository } from '../repositories/analytics.repository';
import type {
  EmployeeSummaryStat,
  ProjectMonthlyUserStat,
  ProjectSummaryStat,
  UserProjectMonthlyStat
} from '../repositories/models';

export type AnalyticsQueryInput = {
  month?: string;
  from?: string;
  to?: string;
  slackUserIds?: string[];
  projectNames?: string[];
  search?: string;
};

export class AnalyticsService {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  async listProjectMonthlyUserStats(query: AnalyticsQueryInput): Promise<{
    period: { from: string; to: string };
    rows: ProjectMonthlyUserStat[];
  }> {
    const filters = this.resolveFilters(query);
    const rows = await this.analyticsRepository.listProjectMonthlyUserStats(filters);
    return { period: { from: filters.fromDateYmd, to: filters.toDateYmd }, rows };
  }

  async listEmployeeSummaryStats(query: AnalyticsQueryInput): Promise<{
    period: { from: string; to: string };
    rows: EmployeeSummaryStat[];
  }> {
    const filters = this.resolveFilters(query);
    const rows = await this.analyticsRepository.listEmployeeSummaryStats(filters);
    return { period: { from: filters.fromDateYmd, to: filters.toDateYmd }, rows };
  }

  async listProjectSummaryStats(query: AnalyticsQueryInput): Promise<{
    period: { from: string; to: string };
    rows: ProjectSummaryStat[];
  }> {
    const filters = this.resolveFilters(query);
    const rows = await this.analyticsRepository.listProjectSummaryStats(filters);
    return { period: { from: filters.fromDateYmd, to: filters.toDateYmd }, rows };
  }

  async listUserProjectMonthlyStats(
    slackUserId: string,
    query: AnalyticsQueryInput
  ): Promise<{
    period: { from: string; to: string };
    slackUserId: string;
    rows: UserProjectMonthlyStat[];
  }> {
    const filters = this.resolveFilters(query);
    const rows = await this.analyticsRepository.listUserProjectMonthlyStats(slackUserId, filters);
    return {
      period: { from: filters.fromDateYmd, to: filters.toDateYmd },
      slackUserId,
      rows
    };
  }

  async listProjectUsersStats(projectName: string, query: AnalyticsQueryInput): Promise<{
    period: { from: string; to: string };
    projectName: string;
    rows: ProjectMonthlyUserStat[];
  }> {
    const filters = this.resolveFilters(query);
    const rows = await this.analyticsRepository.listProjectUsersStats(projectName, filters);
    return {
      period: { from: filters.fromDateYmd, to: filters.toDateYmd },
      projectName,
      rows
    };
  }

  private resolveFilters(query: AnalyticsQueryInput): AnalyticsQueryFilters {
    const fromToRange = this.resolveDateRange(query.from, query.to);
    const monthRange = this.resolveMonthRange(query.month);
    const range = fromToRange || monthRange;

    return {
      fromDateYmd: range.fromDateYmd,
      toDateYmd: range.toDateYmd,
      slackUserIds: (query.slackUserIds || []).filter(Boolean),
      projectNames: (query.projectNames || []).filter(Boolean),
      search: query.search?.trim() || undefined
    };
  }

  private resolveDateRange(
    from?: string,
    to?: string
  ): {
    fromDateYmd: string;
    toDateYmd: string;
  } | null {
    if (!from && !to) return null;
    if (!from || !to) {
      throw new Error('Both from and to are required when using date range filters.');
    }

    const fromDate = DateTime.fromFormat(from, 'yyyy-LL-dd', { zone: env.TIMEZONE }).startOf('day');
    const toDate = DateTime.fromFormat(to, 'yyyy-LL-dd', { zone: env.TIMEZONE }).startOf('day');

    if (!fromDate.isValid || !toDate.isValid) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD for from/to.');
    }

    if (toDate < fromDate) {
      throw new Error('Invalid date range. to must be on or after from.');
    }

    return {
      fromDateYmd: fromDate.toFormat('yyyy-LL-dd'),
      toDateYmd: toDate.toFormat('yyyy-LL-dd')
    };
  }

  private resolveMonthRange(month?: string): {
    fromDateYmd: string;
    toDateYmd: string;
  } {
    const monthStart = month
      ? DateTime.fromFormat(month, 'yyyy-LL', { zone: env.TIMEZONE }).startOf('month')
      : DateTime.now().setZone(env.TIMEZONE).startOf('month');

    if (!monthStart.isValid) {
      throw new Error('Invalid month format. Expected YYYY-MM.');
    }

    const monthEnd = monthStart.endOf('month');
    return {
      fromDateYmd: monthStart.toFormat('yyyy-LL-dd'),
      toDateYmd: monthEnd.toFormat('yyyy-LL-dd')
    };
  }
}
