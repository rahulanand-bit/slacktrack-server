import { dbPool } from '../../config/db';
import type {
  AttendanceProjectSnapshotRow,
  AttendanceRecord,
  AttendanceValue,
  ProjectEntryRecord
} from './models';

export class AttendanceRepository {
  async upsertAttendance(userId: number, dateYmd: string, status: AttendanceValue): Promise<AttendanceRecord> {
    const result = await dbPool.query(
      `
      INSERT INTO attendance_entries (user_id, date_ymd, status)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, date_ymd)
      DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING id, user_id, date_ymd, status, updated_at
      `,
      [userId, dateYmd, status]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      dateYmd: row.date_ymd,
      status: row.status,
      updatedAt: row.updated_at
    };
  }

  async replaceProjects(userId: number, dateYmd: string, projects: string[]): Promise<ProjectEntryRecord[]> {
    await dbPool.query(`DELETE FROM project_entries WHERE user_id = $1 AND date_ymd = $2`, [userId, dateYmd]);

    if (!projects.length) return [];

    const inserts: ProjectEntryRecord[] = [];
    for (let i = 0; i < projects.length; i++) {
      const result = await dbPool.query(
        `
        INSERT INTO project_entries (user_id, date_ymd, slot_index, project_name)
        VALUES ($1, $2, $3, $4)
        RETURNING id, user_id, date_ymd, slot_index, project_name
        `,
        [userId, dateYmd, i + 1, projects[i]]
      );
      const row = result.rows[0];
      inserts.push({
        id: row.id,
        userId: row.user_id,
        dateYmd: row.date_ymd,
        slotIndex: row.slot_index,
        projectName: row.project_name
      });
    }

    return inserts;
  }

  async hasAttendanceForDate(userId: number, dateYmd: string): Promise<boolean> {
    const result = await dbPool.query(
      `
      SELECT 1
      FROM attendance_entries
      WHERE user_id = $1 AND date_ymd = $2
      LIMIT 1
      `,
      [userId, dateYmd]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getAttendanceForDate(userId: number, dateYmd: string): Promise<AttendanceValue | null> {
    const result = await dbPool.query(
      `
      SELECT status
      FROM attendance_entries
      WHERE user_id = $1 AND date_ymd = $2
      LIMIT 1
      `,
      [userId, dateYmd]
    );

    if ((result.rowCount ?? 0) === 0) return null;
    return String(result.rows[0].status) as AttendanceValue;
  }

  async hasProjectsForDate(userId: number, dateYmd: string): Promise<boolean> {
    const result = await dbPool.query(
      `
      SELECT 1
      FROM project_entries
      WHERE user_id = $1 AND date_ymd = $2
      LIMIT 1
      `,
      [userId, dateYmd]
    );

    return (result.rowCount ?? 0) > 0;
  }

  async getProjectsForDate(userId: number, dateYmd: string): Promise<string[]> {
    const result = await dbPool.query(
      `
      SELECT project_name
      FROM project_entries
      WHERE user_id = $1 AND date_ymd = $2
      ORDER BY slot_index ASC
      `,
      [userId, dateYmd]
    );

    return result.rows.map((row) => String(row.project_name));
  }

  async listSnapshotRows(fromDateYmd: string, toDateYmd: string): Promise<AttendanceProjectSnapshotRow[]> {
    const result = await dbPool.query(
      `
      WITH attendance_cte AS (
        SELECT user_id, date_ymd, status
        FROM attendance_entries
        WHERE date_ymd BETWEEN $1::date AND $2::date
      ),
      project_cte AS (
        SELECT
          user_id,
          date_ymd,
          ARRAY_AGG(project_name ORDER BY slot_index ASC) AS projects
        FROM project_entries
        WHERE date_ymd BETWEEN $1::date AND $2::date
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
      `,
      [fromDateYmd, toDateYmd]
    );

    return result.rows.map((row) => ({
      slackUserId: String(row.slack_user_id),
      displayName: row.display_name ? String(row.display_name) : null,
      dateYmd: String(row.date_ymd).slice(0, 10),
      status: (row.status ? String(row.status) : null) as AttendanceValue | null,
      projects: Array.isArray(row.projects) ? row.projects.map((value: unknown) => String(value)) : []
    }));
  }
}
