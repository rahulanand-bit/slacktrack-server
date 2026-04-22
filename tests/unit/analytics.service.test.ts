import { describe, expect, it, vi } from 'vitest';
import { AnalyticsService } from '../../src/api/services/analytics.service';
import type { AnalyticsRepository } from '../../src/api/repositories/analytics.repository';

function buildRepository() {
  return {
    listProjectMonthlyUserStats: vi.fn(),
    listEmployeeSummaryStats: vi.fn(),
    listProjectSummaryStats: vi.fn(),
    listUserProjectMonthlyStats: vi.fn(),
    listProjectUsersStats: vi.fn(),
    listStatusBreakdown: vi.fn(async () => []),
    listDashboardProjectwise: vi.fn(),
    listDashboardEmployeewise: vi.fn(),
    getOverviewStats: vi.fn(async () => ({
      activeUsers: 10,
      presentCount: 8,
      pendingAttendance: 2,
      employeesOnLeave: 1,
      highLeaveEmployees: 1,
      wfhHeavyEmployees: 2,
      attendanceCompliancePct: 80
    })),
    listAttendanceTrend: vi.fn(async () => []),
    listHighLeaveEmployees: vi.fn(async () => []),
    listWfhHeavyEmployees: vi.fn(async () => []),
    listWeeklyWfoBaseline: vi.fn(async () => []),
    listProjectContribution: vi.fn(async () => [])
  };
}

describe('AnalyticsService', () => {
  it('resolves weekly range and returns overview KPI', async () => {
    const repository = buildRepository();
    const service = new AnalyticsService(repository as unknown as AnalyticsRepository);

    const result = await service.getOverview({
      periodType: 'week',
      period: '2026-04-16',
      leaveThreshold: 2,
      wfhRatioThresholdPct: 70,
      minPresentDaysForWfhRatio: 3
    });

    expect(result.periodType).toBe('week');
    expect(result.period).toBe('2026-04-13');
    expect(result.range).toEqual({ from: '2026-04-13', to: '2026-04-19' });
    expect(repository.getOverviewStats).toHaveBeenCalledWith(
      expect.objectContaining({
        fromDateYmd: '2026-04-13',
        toDateYmd: '2026-04-19',
        leaveThreshold: 2,
        wfhRatioThresholdPct: 70,
        minPresentDaysForWfhRatio: 3
      })
    );
  });

  it('returns hr insights with baseline and threshold parameters', async () => {
    const repository = buildRepository();
    const service = new AnalyticsService(repository as unknown as AnalyticsRepository);

    await service.getHrInsights({
      periodType: 'month',
      period: '2026-04',
      leaveThreshold: 3,
      wfhRatioThresholdPct: 65,
      minPresentDaysForWfhRatio: 4,
      baselineWfoDays: 3,
      limit: 15
    });

    expect(repository.listHighLeaveEmployees).toHaveBeenCalledWith(
      expect.objectContaining({
        fromDateYmd: '2026-04-01',
        toDateYmd: '2026-04-30',
        leaveThreshold: 3,
        limit: 15
      })
    );
    expect(repository.listWfhHeavyEmployees).toHaveBeenCalledWith(
      expect.objectContaining({
        wfhRatioThresholdPct: 65,
        minPresentDaysForWfhRatio: 4,
        limit: 15
      })
    );
    expect(repository.listWeeklyWfoBaseline).toHaveBeenCalledWith(
      expect.objectContaining({
        baselineWfoDays: 3,
        limit: 15
      })
    );
  });

  it('returns finance project contribution for selected month', async () => {
    const repository = buildRepository();
    const service = new AnalyticsService(repository as unknown as AnalyticsRepository);

    const result = await service.getFinanceProjectContribution({
      periodType: 'month',
      period: '2026-05'
    });

    expect(result.range).toEqual({ from: '2026-05-01', to: '2026-05-31' });
    expect(repository.listProjectContribution).toHaveBeenCalledWith(
      expect.objectContaining({ fromDateYmd: '2026-05-01', toDateYmd: '2026-05-31' })
    );
  });

  it('returns status breakdown for selected month', async () => {
    const repository = buildRepository();
    const service = new AnalyticsService(repository as unknown as AnalyticsRepository);
    await service.listStatusBreakdownByPeriod({ periodType: 'month', period: '2026-04' });

    expect(repository.listStatusBreakdown).toHaveBeenCalledWith({
      fromDateYmd: '2026-04-01',
      toDateYmd: '2026-04-30'
    });
  });

  it('returns chart payload with top5 projects plus others', async () => {
    const repository = buildRepository();
    repository.listStatusBreakdown.mockResolvedValue([
      { status: 'WFO', count: 10 },
      { status: 'WFH', count: 6 },
      { status: '-1', count: 2 },
      { status: '-0.5', count: 1 }
    ]);
    repository.getOverviewStats.mockResolvedValue({
      activeUsers: 12,
      presentCount: 9,
      pendingAttendance: 3,
      employeesOnLeave: 2,
      highLeaveEmployees: 1,
      wfhHeavyEmployees: 2,
      attendanceCompliancePct: 75
    });
    repository.listProjectContribution.mockResolvedValue([
      { projectName: 'A', activeDays: 8, sharePct: 30 },
      { projectName: 'B', activeDays: 7, sharePct: 20 },
      { projectName: 'C', activeDays: 5, sharePct: 15 },
      { projectName: 'D', activeDays: 4, sharePct: 12 },
      { projectName: 'E', activeDays: 3, sharePct: 10 },
      { projectName: 'F', activeDays: 2, sharePct: 8 },
      { projectName: 'G', activeDays: 1, sharePct: 5 }
    ]);

    const service = new AnalyticsService(repository);
    const result = await service.getCharts({ periodType: 'month', period: '2026-04' });

    expect(result.attendanceMix).toEqual([
      { key: 'WFO', label: 'WFO', value: 10 },
      { key: 'WFH', label: 'WFH', value: 6 },
      { key: 'LEAVE', label: 'Leave', value: 2 },
      { key: 'HALF_DAY', label: 'Half Day', value: 1 }
    ]);
    expect(result.workforceState).toEqual([
      { key: 'PRESENT', label: 'Present', value: 9 },
      { key: 'PENDING', label: 'Pending', value: 3 },
      { key: 'LEAVE', label: 'On Leave', value: 2 }
    ]);
    expect(result.projectShare).toEqual([
      { key: 'A', label: 'A', value: 30 },
      { key: 'B', label: 'B', value: 20 },
      { key: 'C', label: 'C', value: 15 },
      { key: 'D', label: 'D', value: 12 },
      { key: 'E', label: 'E', value: 10 },
      { key: '__others__', label: 'Others', value: 13 }
    ]);
  });

  it('throws on invalid weekly period format', async () => {
    const repository = buildRepository();
    const service = new AnalyticsService(repository as unknown as AnalyticsRepository);

    await expect(service.getTrend({ periodType: 'week', period: '2026/04/16' })).rejects.toThrow(
      'Invalid week period format'
    );
  });
});
