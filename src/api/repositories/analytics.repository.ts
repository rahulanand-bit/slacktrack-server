import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { dateToYmd, ymdToDate } from '../../utils/date-ymd';
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
} from './models';

export type AnalyticsQueryFilters = {
  fromDateYmd: string;
  toDateYmd: string;
  slackUserIds?: string[];
  projectNames?: string[];
  search?: string;
};

export type DashboardProjectRow = {
  projectName: string;
  activeDays: number;
};

export type DashboardEmployeeRow = {
  slackUserId: string;
  displayName: string | null;
  email: string | null;
  wfoCount: number;
  wfhCount: number;
  leaveCount: number;
  halfDayCount: number;
};

export class AnalyticsRepository {
  async getActiveUsersCount(): Promise<number> {
    const rows = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM users
      WHERE active = TRUE
    `);
    return Number(rows[0]?.total ?? 0);
  }

  async getOverviewStats(
    filters: AnalyticsQueryFilters & {
      leaveThreshold: number;
      wfhRatioThresholdPct: number;
      minPresentDaysForWfhRatio: number;
    }
  ): Promise<AnalyticsOverviewStat> {
    const activeUsers = await this.getActiveUsersCount();
    const [presentRows, leaveRows, highLeaveRows, wfhHeavyRows] = await Promise.all([
      prisma.$queryRaw<Array<{ present_count: bigint }>>(Prisma.sql`
        SELECT COUNT(DISTINCT a.user_id)::bigint AS present_count
        FROM attendance_entries a
        INNER JOIN users u ON u.id = a.user_id
        WHERE
          a.date_ymd BETWEEN ${ymdToDate(filters.fromDateYmd)}::date AND ${ymdToDate(filters.toDateYmd)}::date
          AND u.active = TRUE
      `),
      prisma.$queryRaw<Array<{ employees_on_leave: bigint }>>(Prisma.sql`
        SELECT COUNT(DISTINCT a.user_id)::bigint AS employees_on_leave
        FROM attendance_entries a
        INNER JOIN users u ON u.id = a.user_id
        WHERE
          a.date_ymd BETWEEN ${ymdToDate(filters.fromDateYmd)}::date AND ${ymdToDate(filters.toDateYmd)}::date
          AND a.status = '-1'
          AND u.active = TRUE
      `),
      prisma.$queryRaw<Array<{ high_leave_employees: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS high_leave_employees
        FROM (
          SELECT a.user_id
          FROM attendance_entries a
          INNER JOIN users u ON u.id = a.user_id
          WHERE
            a.date_ymd BETWEEN ${ymdToDate(filters.fromDateYmd)}::date AND ${ymdToDate(filters.toDateYmd)}::date
            AND a.status = '-1'
            AND u.active = TRUE
          GROUP BY a.user_id
          HAVING COUNT(*) >= ${filters.leaveThreshold}
        ) thresholded
      `),
      prisma.$queryRaw<Array<{ wfh_heavy_employees: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS wfh_heavy_employees
        FROM (
          SELECT
            a.user_id,
            COUNT(*) FILTER (WHERE a.status = 'WFH')::double precision AS wfh_days,
            COUNT(*) FILTER (WHERE a.status IN ('WFO', 'WFH'))::double precision AS present_days
          FROM attendance_entries a
          INNER JOIN users u ON u.id = a.user_id
          WHERE
            a.date_ymd BETWEEN ${ymdToDate(filters.fromDateYmd)}::date AND ${ymdToDate(filters.toDateYmd)}::date
            AND u.active = TRUE
          GROUP BY a.user_id
          HAVING
            COUNT(*) FILTER (WHERE a.status IN ('WFO', 'WFH')) >= ${filters.minPresentDaysForWfhRatio}
            AND (
              COUNT(*) FILTER (WHERE a.status = 'WFH')::double precision
              / NULLIF(COUNT(*) FILTER (WHERE a.status IN ('WFO', 'WFH'))::double precision, 0)
            ) * 100 >= ${filters.wfhRatioThresholdPct}
        ) thresholded
      `)
    ]);

    const presentCount = Number(presentRows[0]?.present_count ?? 0);
    const employeesOnLeave = Number(leaveRows[0]?.employees_on_leave ?? 0);
    const highLeaveEmployees = Number(highLeaveRows[0]?.high_leave_employees ?? 0);
    const wfhHeavyEmployees = Number(wfhHeavyRows[0]?.wfh_heavy_employees ?? 0);
    const pendingAttendance = Math.max(activeUsers - presentCount, 0);
    const attendanceCompliancePct = activeUsers > 0 ? (presentCount / activeUsers) * 100 : 0;

    return {
      activeUsers,
      presentCount,
      pendingAttendance,
      employeesOnLeave,
      highLeaveEmployees,
      wfhHeavyEmployees,
      attendanceCompliancePct
    };
  }

  async listAttendanceTrend(filters: AnalyticsQueryFilters): Promise<AnalyticsTrendRow[]> {
    const rows = await prisma.$queryRaw<
      Array<{
        date_ymd: Date;
        wfo_count: bigint;
        wfh_count: bigint;
        leave_count: bigint;
        half_day_count: bigint;
        marked_count: bigint;
      }>
    >(Prisma.sql`
      SELECT
        a.date_ymd,
        COUNT(*) FILTER (WHERE a.status = 'WFO')::bigint AS wfo_count,
        COUNT(*) FILTER (WHERE a.status = 'WFH')::bigint AS wfh_count,
        COUNT(*) FILTER (WHERE a.status = '-1')::bigint AS leave_count,
        COUNT(*) FILTER (WHERE a.status = '-0.5')::bigint AS half_day_count,
        COUNT(DISTINCT a.user_id)::bigint AS marked_count
      FROM attendance_entries a
      INNER JOIN users u ON u.id = a.user_id
      WHERE
        a.date_ymd BETWEEN ${ymdToDate(filters.fromDateYmd)}::date AND ${ymdToDate(filters.toDateYmd)}::date
        AND u.active = TRUE
      GROUP BY a.date_ymd
      ORDER BY a.date_ymd ASC
    `);

    return rows.map((row) => ({
      dateYmd: dateToYmd(new Date(row.date_ymd)),
      wfoCount: Number(row.wfo_count),
      wfhCount: Number(row.wfh_count),
      leaveCount: Number(row.leave_count),
      halfDayCount: Number(row.half_day_count),
      markedCount: Number(row.marked_count)
    }));
  }

  async listHighLeaveEmployees(
    filters: AnalyticsQueryFilters & { leaveThreshold: number; limit: number }
  ): Promise<HighLeaveEmployeeRow[]> {
    const rows = await prisma.$queryRaw<
      Array<{
        slack_user_id: string;
        display_name: string | null;
        email: string | null;
        leave_days: bigint;
      }>
    >(Prisma.sql`
      SELECT
        u.slack_user_id,
        u.display_name,
        u.email,
        COUNT(*)::bigint AS leave_days
      FROM attendance_entries a
      INNER JOIN users u ON u.id = a.user_id
      WHERE
        a.date_ymd BETWEEN ${ymdToDate(filters.fromDateYmd)}::date AND ${ymdToDate(filters.toDateYmd)}::date
        AND a.status = '-1'
        AND u.active = TRUE
      GROUP BY u.slack_user_id, u.display_name, u.email
      HAVING COUNT(*) >= ${filters.leaveThreshold}
      ORDER BY leave_days DESC, u.slack_user_id ASC
      LIMIT ${filters.limit}
    `);

    return rows.map((row) => ({
      slackUserId: row.slack_user_id,
      displayName: row.display_name,
      email: row.email,
      leaveDays: Number(row.leave_days)
    }));
  }

  async listWfhHeavyEmployees(
    filters: AnalyticsQueryFilters & {
      wfhRatioThresholdPct: number;
      minPresentDaysForWfhRatio: number;
      limit: number;
    }
  ): Promise<WfhHeavyEmployeeRow[]> {
    const rows = await prisma.$queryRaw<
      Array<{
        slack_user_id: string;
        display_name: string | null;
        email: string | null;
        wfh_days: bigint;
        present_days: bigint;
        wfh_ratio_pct: number;
      }>
    >(Prisma.sql`
      SELECT
        u.slack_user_id,
        u.display_name,
        u.email,
        COUNT(*) FILTER (WHERE a.status = 'WFH')::bigint AS wfh_days,
        COUNT(*) FILTER (WHERE a.status IN ('WFO', 'WFH'))::bigint AS present_days,
        (
          COUNT(*) FILTER (WHERE a.status = 'WFH')::double precision
          / NULLIF(COUNT(*) FILTER (WHERE a.status IN ('WFO', 'WFH'))::double precision, 0)
        ) * 100 AS wfh_ratio_pct
      FROM attendance_entries a
      INNER JOIN users u ON u.id = a.user_id
      WHERE
        a.date_ymd BETWEEN ${ymdToDate(filters.fromDateYmd)}::date AND ${ymdToDate(filters.toDateYmd)}::date
        AND u.active = TRUE
      GROUP BY u.slack_user_id, u.display_name, u.email
      HAVING
        COUNT(*) FILTER (WHERE a.status IN ('WFO', 'WFH')) >= ${filters.minPresentDaysForWfhRatio}
        AND (
          COUNT(*) FILTER (WHERE a.status = 'WFH')::double precision
          / NULLIF(COUNT(*) FILTER (WHERE a.status IN ('WFO', 'WFH'))::double precision, 0)
        ) * 100 >= ${filters.wfhRatioThresholdPct}
      ORDER BY wfh_ratio_pct DESC, present_days DESC, u.slack_user_id ASC
      LIMIT ${filters.limit}
    `);

    return rows.map((row) => ({
      slackUserId: row.slack_user_id,
      displayName: row.display_name,
      email: row.email,
      wfhDays: Number(row.wfh_days),
      presentDays: Number(row.present_days),
      wfhRatioPct: Number(row.wfh_ratio_pct)
    }));
  }

  async listWeeklyWfoBaseline(
    filters: AnalyticsQueryFilters & { baselineWfoDays: number; limit: number }
  ): Promise<WfoBaselineRow[]> {
    const rows = await prisma.$queryRaw<
      Array<{
        slack_user_id: string;
        display_name: string | null;
        email: string | null;
        wfo_days: bigint;
      }>
    >(Prisma.sql`
      SELECT
        u.slack_user_id,
        u.display_name,
        u.email,
        COUNT(*) FILTER (WHERE a.status = 'WFO')::bigint AS wfo_days
      FROM users u
      LEFT JOIN attendance_entries a
        ON a.user_id = u.id
       AND a.date_ymd BETWEEN ${ymdToDate(filters.fromDateYmd)}::date AND ${ymdToDate(filters.toDateYmd)}::date
      WHERE u.active = TRUE
      GROUP BY u.slack_user_id, u.display_name, u.email
      ORDER BY wfo_days ASC, u.slack_user_id ASC
      LIMIT ${filters.limit}
    `);

    return rows.map((row) => {
      const wfoDays = Number(row.wfo_days);
      return {
        slackUserId: row.slack_user_id,
        displayName: row.display_name,
        email: row.email,
        wfoDays,
        meetsBaseline: wfoDays >= filters.baselineWfoDays
      };
    });
  }

  async listProjectContribution(filters: AnalyticsQueryFilters): Promise<ProjectContributionRow[]> {
    const rows = await prisma.$queryRaw<
      Array<{
        project_name: string;
        active_days: number;
      }>
    >(Prisma.sql`
      SELECT
        base.project_name,
        SUM(base.day_value)::double precision AS active_days
      FROM (
        SELECT
          p.project_name,
          p.user_id,
          p.date_ymd,
          MAX(CASE WHEN a.status IN ('WFO', 'WFH') THEN 1.0 ELSE 0.5 END) AS day_value
        FROM project_entries p
        INNER JOIN users u ON u.id = p.user_id
        INNER JOIN attendance_entries a
          ON a.user_id = p.user_id
         AND a.date_ymd = p.date_ymd
        WHERE
          p.date_ymd BETWEEN ${ymdToDate(filters.fromDateYmd)}::date AND ${ymdToDate(filters.toDateYmd)}::date
          AND a.status IN ('WFO', 'WFH', '-0.5')
          AND u.active = TRUE
        GROUP BY p.project_name, p.user_id, p.date_ymd
      ) base
      GROUP BY base.project_name
      ORDER BY active_days DESC, base.project_name ASC
    `);

    const total = rows.reduce((acc, row) => acc + Number(row.active_days), 0);
    return rows.map((row) => {
      const activeDays = Number(row.active_days);
      return {
        projectName: row.project_name,
        activeDays,
        sharePct: total > 0 ? (activeDays / total) * 100 : 0
      };
    });
  }

  async listProjectMonthlyUserStats(filters: AnalyticsQueryFilters): Promise<ProjectMonthlyUserStat[]> {
    const whereClause = this.buildWhereClause(filters);
    const rows = await prisma.$queryRaw<
      Array<{
        slack_user_id: string;
        display_name: string | null;
        email: string | null;
        project_name: string;
        days_worked: number;
      }>
    >(Prisma.sql`
      SELECT
        u.slack_user_id,
        u.display_name,
        u.email,
        p.project_name,
        (
          COUNT(DISTINCT p.date_ymd)
          - 0.5 * COUNT(DISTINCT CASE WHEN a.status = '-0.5' THEN p.date_ymd END)
        )::double precision AS days_worked
      FROM project_entries p
      INNER JOIN users u ON u.id = p.user_id
      INNER JOIN attendance_entries a
        ON a.user_id = p.user_id
       AND a.date_ymd = p.date_ymd
      WHERE ${whereClause}
      GROUP BY u.slack_user_id, u.display_name, u.email, p.project_name
      ORDER BY p.project_name ASC, days_worked DESC, u.slack_user_id ASC
    `);

    return rows.map((row) => ({
      slackUserId: row.slack_user_id,
      displayName: row.display_name,
      email: row.email,
      projectName: row.project_name,
      daysWorked: Number(row.days_worked)
    }));
  }

  async listEmployeeSummaryStats(filters: AnalyticsQueryFilters): Promise<EmployeeSummaryStat[]> {
    const whereClause = this.buildWhereClause(filters);
    const rows = await prisma.$queryRaw<
      Array<{
        slack_user_id: string;
        display_name: string | null;
        email: string | null;
        active_days: number;
      }>
    >(Prisma.sql`
      SELECT
        u.slack_user_id,
        u.display_name,
        u.email,
        (
          COUNT(DISTINCT p.date_ymd)
          - 0.5 * COUNT(DISTINCT CASE WHEN a.status = '-0.5' THEN p.date_ymd END)
        )::double precision AS active_days
      FROM project_entries p
      INNER JOIN users u ON u.id = p.user_id
      INNER JOIN attendance_entries a
        ON a.user_id = p.user_id
       AND a.date_ymd = p.date_ymd
      WHERE ${whereClause}
      GROUP BY u.slack_user_id, u.display_name, u.email
      ORDER BY active_days DESC, u.slack_user_id ASC
    `);

    return rows.map((row) => ({
      slackUserId: row.slack_user_id,
      displayName: row.display_name,
      email: row.email,
      activeDays: Number(row.active_days)
    }));
  }

  async listProjectSummaryStats(filters: AnalyticsQueryFilters): Promise<ProjectSummaryStat[]> {
    const whereClause = this.buildWhereClause(filters);
    const rows = await prisma.$queryRaw<
      Array<{
        project_name: string;
        active_days: number;
      }>
    >(Prisma.sql`
      SELECT
        base.project_name,
        SUM(base.day_value)::double precision AS active_days
      FROM (
        SELECT
          p.project_name,
          p.date_ymd,
          MAX(CASE WHEN a.status IN ('WFO', 'WFH') THEN 1.0 ELSE 0.5 END) AS day_value
        FROM project_entries p
        INNER JOIN users u ON u.id = p.user_id
        INNER JOIN attendance_entries a
          ON a.user_id = p.user_id
         AND a.date_ymd = p.date_ymd
        WHERE ${whereClause}
        GROUP BY p.project_name, p.date_ymd
      ) base
      GROUP BY base.project_name
      ORDER BY active_days DESC, base.project_name ASC
    `);

    return rows.map((row) => ({
      projectName: row.project_name,
      activeDays: Number(row.active_days)
    }));
  }

  async listUserProjectMonthlyStats(
    slackUserId: string,
    filters: AnalyticsQueryFilters
  ): Promise<UserProjectMonthlyStat[]> {
    const whereClause = this.buildWhereClause({
      ...filters,
      slackUserIds: [slackUserId]
    });
    const rows = await prisma.$queryRaw<
      Array<{
        project_name: string;
        days_worked: number;
      }>
    >(Prisma.sql`
      SELECT
        p.project_name,
        (
          COUNT(DISTINCT p.date_ymd)
          - 0.5 * COUNT(DISTINCT CASE WHEN a.status = '-0.5' THEN p.date_ymd END)
        )::double precision AS days_worked
      FROM project_entries p
      INNER JOIN users u ON u.id = p.user_id
      INNER JOIN attendance_entries a
        ON a.user_id = p.user_id
       AND a.date_ymd = p.date_ymd
      WHERE ${whereClause}
      GROUP BY p.project_name
      ORDER BY days_worked DESC, p.project_name ASC
    `);

    return rows.map((row) => ({
      projectName: row.project_name,
      daysWorked: Number(row.days_worked)
    }));
  }

  async listProjectUsersStats(projectName: string, filters: AnalyticsQueryFilters): Promise<ProjectMonthlyUserStat[]> {
    const whereClause = this.buildWhereClause({
      ...filters,
      projectNames: [projectName]
    });
    const rows = await prisma.$queryRaw<
      Array<{
        slack_user_id: string;
        display_name: string | null;
        email: string | null;
        project_name: string;
        days_worked: number;
      }>
    >(Prisma.sql`
      SELECT
        u.slack_user_id,
        u.display_name,
        u.email,
        p.project_name,
        (
          COUNT(DISTINCT p.date_ymd)
          - 0.5 * COUNT(DISTINCT CASE WHEN a.status = '-0.5' THEN p.date_ymd END)
        )::double precision AS days_worked
      FROM project_entries p
      INNER JOIN users u ON u.id = p.user_id
      INNER JOIN attendance_entries a
        ON a.user_id = p.user_id
       AND a.date_ymd = p.date_ymd
      WHERE ${whereClause}
      GROUP BY u.slack_user_id, u.display_name, u.email, p.project_name
      ORDER BY days_worked DESC, u.slack_user_id ASC
    `);

    return rows.map((row) => ({
      slackUserId: row.slack_user_id,
      displayName: row.display_name,
      email: row.email,
      projectName: row.project_name,
      daysWorked: Number(row.days_worked)
    }));
  }

  async listStatusBreakdown(filters: AnalyticsQueryFilters): Promise<StatusBreakdownStat[]> {
    const rows = await prisma.$queryRaw<Array<{ status: string; count: bigint }>>(Prisma.sql`
      SELECT
        a.status,
        COUNT(*)::bigint AS count
      FROM attendance_entries a
      INNER JOIN users u ON u.id = a.user_id
      WHERE
        a.date_ymd BETWEEN ${ymdToDate(filters.fromDateYmd)}::date AND ${ymdToDate(filters.toDateYmd)}::date
        AND u.active = TRUE
      GROUP BY a.status
    `);

    return rows.map((row) => ({
      status: row.status as StatusBreakdownStat['status'],
      count: Number(row.count)
    }));
  }

  async listDashboardProjectwise(
    filters: AnalyticsQueryFilters & { page: number; pageSize: number }
  ): Promise<{ rows: DashboardProjectRow[]; total: number }> {
    const whereClause = this.buildWhereClause(filters);
    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<Array<{ project_name: string; active_days: number }>>(Prisma.sql`
        SELECT
          base.project_name,
          SUM(base.day_value)::double precision AS active_days
        FROM (
          SELECT
            p.project_name,
            p.date_ymd,
            MAX(CASE WHEN a.status IN ('WFO', 'WFH') THEN 1.0 ELSE 0.5 END) AS day_value
          FROM project_entries p
          INNER JOIN users u ON u.id = p.user_id
          INNER JOIN attendance_entries a
            ON a.user_id = p.user_id
           AND a.date_ymd = p.date_ymd
          WHERE ${whereClause}
          GROUP BY p.project_name, p.date_ymd
        ) base
        GROUP BY base.project_name
        ORDER BY active_days DESC, base.project_name ASC
        OFFSET ${(filters.page - 1) * filters.pageSize}
        LIMIT ${filters.pageSize}
      `),
      prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM (
          SELECT p.project_name
          FROM project_entries p
          INNER JOIN users u ON u.id = p.user_id
          INNER JOIN attendance_entries a
            ON a.user_id = p.user_id
           AND a.date_ymd = p.date_ymd
          WHERE ${whereClause}
          GROUP BY p.project_name
        ) grouped
      `)
    ]);

    return {
      rows: rows.map((row) => ({
        projectName: row.project_name,
        activeDays: Number(row.active_days)
      })),
      total: Number(countRows[0]?.total ?? 0)
    };
  }

  async listDashboardEmployeewise(
    filters: AnalyticsQueryFilters & { page: number; pageSize: number }
  ): Promise<{ rows: DashboardEmployeeRow[]; total: number }> {
    const like = `%${(filters.search || '').trim()}%`;
    const shouldFilterSearch = Boolean((filters.search || '').trim());
    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          slack_user_id: string;
          display_name: string | null;
          email: string | null;
          wfo_count: bigint;
          wfh_count: bigint;
          leave_count: bigint;
          half_day_count: bigint;
        }>
      >(Prisma.sql`
        SELECT
          u.slack_user_id,
          u.display_name,
          u.email,
          COUNT(*) FILTER (WHERE a.status = 'WFO')::bigint AS wfo_count,
          COUNT(*) FILTER (WHERE a.status = 'WFH')::bigint AS wfh_count,
          COUNT(*) FILTER (WHERE a.status = '-1')::bigint AS leave_count,
          COUNT(*) FILTER (WHERE a.status = '-0.5')::bigint AS half_day_count
        FROM attendance_entries a
        INNER JOIN users u ON u.id = a.user_id
        WHERE
          a.date_ymd BETWEEN ${ymdToDate(filters.fromDateYmd)}::date AND ${ymdToDate(filters.toDateYmd)}::date
          AND u.active = TRUE
          AND ${
            shouldFilterSearch
              ? Prisma.sql`(u.display_name ILIKE ${like} OR u.email ILIKE ${like} OR u.slack_user_id ILIKE ${like})`
              : Prisma.sql`TRUE`
          }
        GROUP BY u.slack_user_id, u.display_name, u.email
        ORDER BY (COUNT(*) FILTER (WHERE a.status IN ('WFO', 'WFH', '-1', '-0.5'))) DESC, u.slack_user_id ASC
        OFFSET ${(filters.page - 1) * filters.pageSize}
        LIMIT ${filters.pageSize}
      `),
      prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM (
          SELECT u.slack_user_id
          FROM attendance_entries a
          INNER JOIN users u ON u.id = a.user_id
          WHERE
            a.date_ymd BETWEEN ${ymdToDate(filters.fromDateYmd)}::date AND ${ymdToDate(filters.toDateYmd)}::date
            AND u.active = TRUE
            AND ${
              shouldFilterSearch
                ? Prisma.sql`(u.display_name ILIKE ${like} OR u.email ILIKE ${like} OR u.slack_user_id ILIKE ${like})`
                : Prisma.sql`TRUE`
            }
          GROUP BY u.slack_user_id
        ) grouped
      `)
    ]);

    return {
      rows: rows.map((row) => ({
        slackUserId: row.slack_user_id,
        displayName: row.display_name,
        email: row.email,
        wfoCount: Number(row.wfo_count),
        wfhCount: Number(row.wfh_count),
        leaveCount: Number(row.leave_count),
        halfDayCount: Number(row.half_day_count)
      })),
      total: Number(countRows[0]?.total ?? 0)
    };
  }

  private buildWhereClause(filters: AnalyticsQueryFilters): Prisma.Sql {
    const clauses: Prisma.Sql[] = [
      Prisma.sql`p.date_ymd BETWEEN ${ymdToDate(filters.fromDateYmd)}::date AND ${ymdToDate(filters.toDateYmd)}::date`,
      Prisma.sql`a.status IN ('WFO', 'WFH', '-0.5')`,
      Prisma.sql`u.active = TRUE`
    ];

    if (filters.slackUserIds && filters.slackUserIds.length > 0) {
      clauses.push(Prisma.sql`u.slack_user_id IN (${Prisma.join(filters.slackUserIds)})`);
    }

    if (filters.projectNames && filters.projectNames.length > 0) {
      clauses.push(Prisma.sql`p.project_name IN (${Prisma.join(filters.projectNames)})`);
    }

    const search = (filters.search || '').trim();
    if (search) {
      const like = `%${search}%`;
      clauses.push(
        Prisma.sql`(
          u.display_name ILIKE ${like}
          OR u.email ILIKE ${like}
          OR u.slack_user_id ILIKE ${like}
          OR p.project_name ILIKE ${like}
        )`
      );
    }

    return Prisma.sql`${Prisma.join(clauses, ' AND ')}`;
  }
}
