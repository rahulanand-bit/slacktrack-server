import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { dateToYmd, ymdToDate } from '../../utils/date-ymd';
import type {
  AttendanceProjectSnapshotRow,
  AttendanceRecord,
  AttendanceValue,
  ProjectEntryRecord
} from './models';

function mapAttendance(row: {
  id: bigint;
  userId: bigint;
  dateYmd: Date;
  status: string;
  updatedAt: Date;
}): AttendanceRecord {
  return {
    id: Number(row.id),
    userId: Number(row.userId),
    dateYmd: dateToYmd(row.dateYmd),
    status: row.status as AttendanceValue,
    updatedAt: row.updatedAt
  };
}

function mapProjectEntry(row: {
  id: bigint;
  userId: bigint;
  dateYmd: Date;
  slotIndex: number;
  projectName: string;
}): ProjectEntryRecord {
  return {
    id: Number(row.id),
    userId: Number(row.userId),
    dateYmd: dateToYmd(row.dateYmd),
    slotIndex: row.slotIndex,
    projectName: row.projectName
  };
}

export class AttendanceRepository {
  async upsertAttendance(userId: number, dateYmd: string, status: AttendanceValue): Promise<AttendanceRecord> {
    const row = await prisma.attendanceEntry.upsert({
      where: {
        userId_dateYmd: {
          userId: BigInt(userId),
          dateYmd: ymdToDate(dateYmd)
        }
      },
      update: {
        status,
        updatedAt: new Date()
      },
      create: {
        userId: BigInt(userId),
        dateYmd: ymdToDate(dateYmd),
        status
      }
    });

    return mapAttendance(row);
  }

  async replaceProjects(userId: number, dateYmd: string, projects: string[]): Promise<ProjectEntryRecord[]> {
    const targetDate = ymdToDate(dateYmd);

    await prisma.$transaction(async (tx) => {
      await tx.projectEntry.deleteMany({
        where: {
          userId: BigInt(userId),
          dateYmd: targetDate
        }
      });

      if (projects.length > 0) {
        await tx.projectEntry.createMany({
          data: projects.map((projectName, index) => ({
            userId: BigInt(userId),
            dateYmd: targetDate,
            slotIndex: index + 1,
            projectName
          }))
        });
      }
    });

    const inserted = await prisma.projectEntry.findMany({
      where: {
        userId: BigInt(userId),
        dateYmd: targetDate
      },
      orderBy: { slotIndex: 'asc' }
    });

    return inserted.map((row) => mapProjectEntry(row));
  }

  async hasAttendanceForDate(userId: number, dateYmd: string): Promise<boolean> {
    const count = await prisma.attendanceEntry.count({
      where: {
        userId: BigInt(userId),
        dateYmd: ymdToDate(dateYmd)
      }
    });

    return count > 0;
  }

  async getAttendanceForDate(userId: number, dateYmd: string): Promise<AttendanceValue | null> {
    const row = await prisma.attendanceEntry.findUnique({
      where: {
        userId_dateYmd: {
          userId: BigInt(userId),
          dateYmd: ymdToDate(dateYmd)
        }
      },
      select: { status: true }
    });

    if (!row) return null;
    return row.status as AttendanceValue;
  }

  async hasProjectsForDate(userId: number, dateYmd: string): Promise<boolean> {
    const count = await prisma.projectEntry.count({
      where: {
        userId: BigInt(userId),
        dateYmd: ymdToDate(dateYmd)
      }
    });

    return count > 0;
  }

  async getProjectsForDate(userId: number, dateYmd: string): Promise<string[]> {
    const rows = await prisma.projectEntry.findMany({
      where: {
        userId: BigInt(userId),
        dateYmd: ymdToDate(dateYmd)
      },
      orderBy: { slotIndex: 'asc' },
      select: { projectName: true }
    });

    return rows.map((row) => row.projectName);
  }

  async listSnapshotRows(fromDateYmd: string, toDateYmd: string): Promise<AttendanceProjectSnapshotRow[]> {
    const rows = await prisma.$queryRaw<
      Array<{
        slack_user_id: string;
        display_name: string | null;
        date_ymd: Date;
        status: string | null;
        projects: string[];
      }>
    >(Prisma.sql`
      WITH attendance_cte AS (
        SELECT user_id, date_ymd, status
        FROM attendance_entries
        WHERE date_ymd BETWEEN ${ymdToDate(fromDateYmd)}::date AND ${ymdToDate(toDateYmd)}::date
      ),
      project_cte AS (
        SELECT
          user_id,
          date_ymd,
          ARRAY_AGG(project_name ORDER BY slot_index ASC) AS projects
        FROM project_entries
        WHERE date_ymd BETWEEN ${ymdToDate(fromDateYmd)}::date AND ${ymdToDate(toDateYmd)}::date
        GROUP BY user_id, date_ymd
      ),
      merged AS (
        SELECT
          COALESCE(a.user_id, p.user_id) AS user_id,
          COALESCE(a.date_ymd, p.date_ymd) AS date_ymd,
          a.status,
          COALESCE(p.projects, ARRAY[]::TEXT[]) AS projects
        FROM attendance_cte a
        FULL OUTER JOIN project_cte p
          ON p.user_id = a.user_id
         AND p.date_ymd = a.date_ymd
      )
      SELECT
        u.slack_user_id,
        u.display_name,
        merged.date_ymd,
        merged.status,
        merged.projects
      FROM merged
      INNER JOIN users u ON u.id = merged.user_id
      ORDER BY merged.date_ymd ASC, u.slack_user_id ASC
    `);

    return rows.map((row) => ({
      slackUserId: row.slack_user_id,
      displayName: row.display_name,
      dateYmd: dateToYmd(new Date(row.date_ymd)),
      status: (row.status as AttendanceValue | null) ?? null,
      projects: Array.isArray(row.projects) ? row.projects.map((value) => String(value)) : []
    }));
  }
}
