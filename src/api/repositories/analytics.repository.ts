import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ymdToDate } from '../../utils/date-ymd';
import type {
  EmployeeSummaryStat,
  ProjectMonthlyUserStat,
  ProjectSummaryStat,
  UserProjectMonthlyStat
} from './models';

export type AnalyticsQueryFilters = {
  fromDateYmd: string;
  toDateYmd: string;
  slackUserIds?: string[];
  projectNames?: string[];
  search?: string;
};

export class AnalyticsRepository {
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

  private buildWhereClause(filters: AnalyticsQueryFilters): Prisma.Sql {
    const clauses: Prisma.Sql[] = [
      Prisma.sql`p.date_ymd BETWEEN ${ymdToDate(filters.fromDateYmd)}::date AND ${ymdToDate(filters.toDateYmd)}::date`,
      Prisma.sql`a.status IN ('WFO', 'WFH', '-0.5')`
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
