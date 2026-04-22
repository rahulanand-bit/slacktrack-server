import { DateTime } from 'luxon';
import { env } from '../../config/env';
import type {
  AnalyticsQueryFilters,
  AnalyticsRepository,
  DashboardEmployeeRow,
  DashboardProjectRow
} from '../repositories/analytics.repository';
import type {
  AnalyticsOverviewStat,
  AnalyticsTrendRow,
  EmployeeSummaryStat,
  HighLeaveEmployeeRow,
  ProjectContributionRow,
  ProjectMonthlyUserStat,
  ProjectSummaryStat,
  StatusBreakdownStat,
  UserProjectMonthlyStat,
  WfhHeavyEmployeeRow,
  WfoBaselineRow
} from '../repositories/models';

export type AnalyticsQueryInput = {
  month?: string;
  from?: string;
  to?: string;
  slackUserIds?: string[];
  projectNames?: string[];
  search?: string;
};

export type PeriodType = 'week' | 'month';

export class AnalyticsService {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  async getCharts(input: {
    periodType: PeriodType;
    period?: string;
  }): Promise<{
    periodType: PeriodType;
    period: string;
    range: { from: string; to: string };
    generatedAt: string;
    attendanceMix: Array<{ key: 'WFO' | 'WFH' | 'LEAVE' | 'HALF_DAY'; label: string; value: number }>;
    workforceState: Array<{ key: 'PRESENT' | 'PENDING' | 'LEAVE'; label: string; value: number }>;
    projectShare: Array<{ key: string; label: string; value: number }>;
  }> {
    const range = this.resolvePeriodRange(input.periodType, input.period);
    const [statusRows, overview, projectContributionRows] = await Promise.all([
      this.analyticsRepository.listStatusBreakdown({
        fromDateYmd: range.fromDateYmd,
        toDateYmd: range.toDateYmd
      }),
      this.analyticsRepository.getOverviewStats({
        fromDateYmd: range.fromDateYmd,
        toDateYmd: range.toDateYmd,
        leaveThreshold: 2,
        wfhRatioThresholdPct: 70,
        minPresentDaysForWfhRatio: 3
      }),
      this.analyticsRepository.listProjectContribution({
        fromDateYmd: range.fromDateYmd,
        toDateYmd: range.toDateYmd
      })
    ]);

    const statusMap = new Map(statusRows.map((row) => [row.status, row.count]));
    const attendanceMix = [
      { key: 'WFO' as const, label: 'WFO', value: Number(statusMap.get('WFO') || 0) },
      { key: 'WFH' as const, label: 'WFH', value: Number(statusMap.get('WFH') || 0) },
      { key: 'LEAVE' as const, label: 'Leave', value: Number(statusMap.get('-1') || 0) },
      { key: 'HALF_DAY' as const, label: 'Half Day', value: Number(statusMap.get('-0.5') || 0) }
    ];

    const workforceState = [
      { key: 'PRESENT' as const, label: 'Present', value: overview.presentCount },
      { key: 'PENDING' as const, label: 'Pending', value: overview.pendingAttendance },
      { key: 'LEAVE' as const, label: 'On Leave', value: overview.employeesOnLeave }
    ];

    const topProjects = projectContributionRows.slice(0, 5);
    const othersValue = projectContributionRows.slice(5).reduce((sum, row) => sum + row.sharePct, 0);
    const projectShare = [
      ...topProjects.map((row) => ({
        key: row.projectName,
        label: row.projectName,
        value: row.sharePct
      })),
      ...(othersValue > 0 ? [{ key: '__others__', label: 'Others', value: othersValue }] : [])
    ];

    return {
      periodType: input.periodType,
      period: range.period,
      range: { from: range.fromDateYmd, to: range.toDateYmd },
      generatedAt: DateTime.now().setZone(env.TIMEZONE).toISO() || new Date().toISOString(),
      attendanceMix,
      workforceState,
      projectShare
    };
  }

  async getOverview(input: {
    periodType: PeriodType;
    period?: string;
    leaveThreshold: number;
    wfhRatioThresholdPct: number;
    minPresentDaysForWfhRatio: number;
  }): Promise<{
    periodType: PeriodType;
    period: string;
    range: { from: string; to: string };
    kpi: AnalyticsOverviewStat;
  }> {
    const range = this.resolvePeriodRange(input.periodType, input.period);
    const kpi = await this.analyticsRepository.getOverviewStats({
      fromDateYmd: range.fromDateYmd,
      toDateYmd: range.toDateYmd,
      leaveThreshold: input.leaveThreshold,
      wfhRatioThresholdPct: input.wfhRatioThresholdPct,
      minPresentDaysForWfhRatio: input.minPresentDaysForWfhRatio
    });

    return {
      periodType: input.periodType,
      period: range.period,
      range: { from: range.fromDateYmd, to: range.toDateYmd },
      kpi
    };
  }

  async getTrend(input: {
    periodType: PeriodType;
    period?: string;
  }): Promise<{
    periodType: PeriodType;
    period: string;
    range: { from: string; to: string };
    rows: AnalyticsTrendRow[];
  }> {
    const range = this.resolvePeriodRange(input.periodType, input.period);
    const rows = await this.analyticsRepository.listAttendanceTrend({
      fromDateYmd: range.fromDateYmd,
      toDateYmd: range.toDateYmd
    });
    return {
      periodType: input.periodType,
      period: range.period,
      range: { from: range.fromDateYmd, to: range.toDateYmd },
      rows
    };
  }

  async getHrInsights(input: {
    periodType: PeriodType;
    period?: string;
    leaveThreshold: number;
    wfhRatioThresholdPct: number;
    minPresentDaysForWfhRatio: number;
    baselineWfoDays: number;
    limit: number;
  }): Promise<{
    periodType: PeriodType;
    period: string;
    range: { from: string; to: string };
    leaveThreshold: number;
    wfhRatioThresholdPct: number;
    baselineWfoDays: number;
    highLeaveEmployees: HighLeaveEmployeeRow[];
    wfhHeavyEmployees: WfhHeavyEmployeeRow[];
    wfoBaseline: WfoBaselineRow[];
  }> {
    const range = this.resolvePeriodRange(input.periodType, input.period);
    const [highLeaveEmployees, wfhHeavyEmployees, wfoBaseline] = await Promise.all([
      this.analyticsRepository.listHighLeaveEmployees({
        fromDateYmd: range.fromDateYmd,
        toDateYmd: range.toDateYmd,
        leaveThreshold: input.leaveThreshold,
        limit: input.limit
      }),
      this.analyticsRepository.listWfhHeavyEmployees({
        fromDateYmd: range.fromDateYmd,
        toDateYmd: range.toDateYmd,
        wfhRatioThresholdPct: input.wfhRatioThresholdPct,
        minPresentDaysForWfhRatio: input.minPresentDaysForWfhRatio,
        limit: input.limit
      }),
      this.analyticsRepository.listWeeklyWfoBaseline({
        fromDateYmd: range.fromDateYmd,
        toDateYmd: range.toDateYmd,
        baselineWfoDays: input.baselineWfoDays,
        limit: input.limit
      })
    ]);

    return {
      periodType: input.periodType,
      period: range.period,
      range: { from: range.fromDateYmd, to: range.toDateYmd },
      leaveThreshold: input.leaveThreshold,
      wfhRatioThresholdPct: input.wfhRatioThresholdPct,
      baselineWfoDays: input.baselineWfoDays,
      highLeaveEmployees,
      wfhHeavyEmployees,
      wfoBaseline
    };
  }

  async getFinanceProjectContribution(input: {
    periodType: PeriodType;
    period?: string;
  }): Promise<{
    periodType: PeriodType;
    period: string;
    range: { from: string; to: string };
    rows: ProjectContributionRow[];
  }> {
    const range = this.resolvePeriodRange(input.periodType, input.period);
    const rows = await this.analyticsRepository.listProjectContribution({
      fromDateYmd: range.fromDateYmd,
      toDateYmd: range.toDateYmd
    });
    return {
      periodType: input.periodType,
      period: range.period,
      range: { from: range.fromDateYmd, to: range.toDateYmd },
      rows
    };
  }

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

  async listStatusBreakdown(query: AnalyticsQueryInput): Promise<{
    period: { from: string; to: string };
    rows: StatusBreakdownStat[];
  }> {
    const filters = this.resolveFilters(query);
    const rows = await this.analyticsRepository.listStatusBreakdown(filters);
    return {
      period: { from: filters.fromDateYmd, to: filters.toDateYmd },
      rows
    };
  }

  async listStatusBreakdownByPeriod(input: {
    periodType: PeriodType;
    period?: string;
  }): Promise<{
    period: { from: string; to: string };
    rows: StatusBreakdownStat[];
  }> {
    const range = this.resolvePeriodRange(input.periodType, input.period);
    const rows = await this.analyticsRepository.listStatusBreakdown({
      fromDateYmd: range.fromDateYmd,
      toDateYmd: range.toDateYmd
    });
    return { period: { from: range.fromDateYmd, to: range.toDateYmd }, rows };
  }

  async listDashboardProjectwise(input: {
    periodType: PeriodType;
    period?: string;
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<{
    periodType: PeriodType;
    period: string;
    page: number;
    pageSize: number;
    total: number;
    rows: DashboardProjectRow[];
  }> {
    const range = this.resolvePeriodRange(input.periodType, input.period);
    const result = await this.analyticsRepository.listDashboardProjectwise({
      fromDateYmd: range.fromDateYmd,
      toDateYmd: range.toDateYmd,
      page: input.page,
      pageSize: input.pageSize,
      search: input.search?.trim() || undefined
    });

    return {
      periodType: input.periodType,
      period: range.period,
      page: input.page,
      pageSize: input.pageSize,
      total: result.total,
      rows: result.rows
    };
  }

  async listDashboardEmployeewise(input: {
    periodType: PeriodType;
    period?: string;
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<{
    periodType: PeriodType;
    period: string;
    page: number;
    pageSize: number;
    total: number;
    rows: DashboardEmployeeRow[];
  }> {
    const range = this.resolvePeriodRange(input.periodType, input.period);
    const result = await this.analyticsRepository.listDashboardEmployeewise({
      fromDateYmd: range.fromDateYmd,
      toDateYmd: range.toDateYmd,
      page: input.page,
      pageSize: input.pageSize,
      search: input.search?.trim() || undefined
    });

    return {
      periodType: input.periodType,
      period: range.period,
      page: input.page,
      pageSize: input.pageSize,
      total: result.total,
      rows: result.rows
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

  private resolvePeriodRange(periodType: PeriodType, period?: string): {
    fromDateYmd: string;
    toDateYmd: string;
    period: string;
  } {
    if (periodType === 'week') {
      const seed = period
        ? DateTime.fromFormat(period, 'yyyy-LL-dd', { zone: env.TIMEZONE }).startOf('day')
        : DateTime.now().setZone(env.TIMEZONE).startOf('day');

      if (!seed.isValid) {
        throw new Error('Invalid week period format. Expected YYYY-MM-DD.');
      }

      const start = seed.startOf('week');
      const end = start.plus({ days: 6 });
      return {
        fromDateYmd: start.toFormat('yyyy-LL-dd'),
        toDateYmd: end.toFormat('yyyy-LL-dd'),
        period: start.toFormat('yyyy-LL-dd')
      };
    }

    const monthStart = period
      ? DateTime.fromFormat(period, 'yyyy-LL', { zone: env.TIMEZONE }).startOf('month')
      : DateTime.now().setZone(env.TIMEZONE).startOf('month');

    if (!monthStart.isValid) {
      throw new Error('Invalid month period format. Expected YYYY-MM.');
    }

    return {
      fromDateYmd: monthStart.toFormat('yyyy-LL-dd'),
      toDateYmd: monthStart.endOf('month').toFormat('yyyy-LL-dd'),
      period: monthStart.toFormat('yyyy-LL')
    };
  }
}
