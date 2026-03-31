import { DateTime } from 'luxon';
import { env } from '../../config/env';
import type { AnalyticsRepository } from '../repositories/analytics.repository';
import type { ProjectMonthlyUserStat, UserProjectMonthlyStat } from '../repositories/models';

export class AnalyticsService {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  async listProjectMonthlyUserStats(month?: string): Promise<{
    month: string;
    rows: ProjectMonthlyUserStat[];
  }> {
    const { monthKey, fromDateYmd, toDateYmd } = this.resolveMonthRange(month);
    const rows = await this.analyticsRepository.listProjectMonthlyUserStats(fromDateYmd, toDateYmd);
    return { month: monthKey, rows };
  }

  async listUserProjectMonthlyStats(
    slackUserId: string,
    month?: string
  ): Promise<{
    month: string;
    slackUserId: string;
    rows: UserProjectMonthlyStat[];
  }> {
    const { monthKey, fromDateYmd, toDateYmd } = this.resolveMonthRange(month);
    const rows = await this.analyticsRepository.listUserProjectMonthlyStats(slackUserId, fromDateYmd, toDateYmd);
    return { month: monthKey, slackUserId, rows };
  }

  private resolveMonthRange(month?: string): {
    monthKey: string;
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
      monthKey: monthStart.toFormat('yyyy-LL'),
      fromDateYmd: monthStart.toFormat('yyyy-LL-dd'),
      toDateYmd: monthEnd.toFormat('yyyy-LL-dd')
    };
  }
}
