import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ymdToDate } from '../../utils/date-ymd';
import type { ProjectMonthlyUserStat, UserProjectMonthlyStat } from './models';

export class AnalyticsRepository {
  async listProjectMonthlyUserStats(fromDateYmd: string, toDateYmd: string): Promise<ProjectMonthlyUserStat[]> {
    const rows = await prisma.$queryRaw<
      Array<{
        slack_user_id: string;
        display_name: string | null;
        email: string | null;
        project_name: string;
        days_worked: bigint;
      }>
    >(Prisma.sql`
      SELECT
        u.slack_user_id,
        u.display_name,
        u.email,
        p.project_name,
        COUNT(DISTINCT p.date_ymd) AS days_worked
      FROM project_entries p
      INNER JOIN users u ON u.id = p.user_id
      INNER JOIN attendance_entries a
        ON a.user_id = p.user_id
       AND a.date_ymd = p.date_ymd
      WHERE p.date_ymd BETWEEN ${ymdToDate(fromDateYmd)}::date AND ${ymdToDate(toDateYmd)}::date
        AND a.status IN ('WFO', 'WFH')
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

  async listUserProjectMonthlyStats(
    slackUserId: string,
    fromDateYmd: string,
    toDateYmd: string
  ): Promise<UserProjectMonthlyStat[]> {
    const rows = await prisma.$queryRaw<
      Array<{
        project_name: string;
        days_worked: bigint;
      }>
    >(Prisma.sql`
      SELECT
        p.project_name,
        COUNT(DISTINCT p.date_ymd) AS days_worked
      FROM project_entries p
      INNER JOIN users u ON u.id = p.user_id
      INNER JOIN attendance_entries a
        ON a.user_id = p.user_id
       AND a.date_ymd = p.date_ymd
      WHERE u.slack_user_id = ${slackUserId}
        AND p.date_ymd BETWEEN ${ymdToDate(fromDateYmd)}::date AND ${ymdToDate(toDateYmd)}::date
        AND a.status IN ('WFO', 'WFH')
      GROUP BY p.project_name
      ORDER BY days_worked DESC, p.project_name ASC
    `);

    return rows.map((row) => ({
      projectName: row.project_name,
      daysWorked: Number(row.days_worked)
    }));
  }
}
