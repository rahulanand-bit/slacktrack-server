import { dbPool } from '../../config/db';
import type { ReminderTimerRecord } from './models';

export type CreateTimerInput = {
  name: string;
  timerType: 'morning' | 'evening' | 'custom';
  cronExpression: string;
  timezone: string;
  active: boolean;
};

export type UpdateTimerInput = Partial<CreateTimerInput>;

function mapTimerRow(row: Record<string, unknown>): ReminderTimerRecord {
  return {
    id: Number(row.id),
    name: String(row.name),
    timerType: row.timer_type as ReminderTimerRecord['timerType'],
    cronExpression: String(row.cron_expression),
    timezone: String(row.timezone),
    active: Boolean(row.active),
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date
  };
}

export class TimerRepository {
  async listTimers(): Promise<ReminderTimerRecord[]> {
    const result = await dbPool.query(
      `
      SELECT id, name, timer_type, cron_expression, timezone, active, created_at, updated_at
      FROM reminder_timers
      ORDER BY id ASC
      `
    );
    return result.rows.map((row) => mapTimerRow(row));
  }

  async listActiveTimers(): Promise<ReminderTimerRecord[]> {
    const result = await dbPool.query(
      `
      SELECT id, name, timer_type, cron_expression, timezone, active, created_at, updated_at
      FROM reminder_timers
      WHERE active = TRUE
      ORDER BY id ASC
      `
    );
    return result.rows.map((row) => mapTimerRow(row));
  }

  async getTimerById(id: number): Promise<ReminderTimerRecord | null> {
    const result = await dbPool.query(
      `
      SELECT id, name, timer_type, cron_expression, timezone, active, created_at, updated_at
      FROM reminder_timers
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );
    if (result.rowCount === 0) return null;
    return mapTimerRow(result.rows[0]);
  }

  async createTimer(input: CreateTimerInput): Promise<ReminderTimerRecord> {
    const result = await dbPool.query(
      `
      INSERT INTO reminder_timers (name, timer_type, cron_expression, timezone, active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, timer_type, cron_expression, timezone, active, created_at, updated_at
      `,
      [input.name, input.timerType, input.cronExpression, input.timezone, input.active]
    );
    return mapTimerRow(result.rows[0]);
  }

  async updateTimer(id: number, input: UpdateTimerInput): Promise<ReminderTimerRecord | null> {
    const existing = await this.getTimerById(id);
    if (!existing) return null;

    const result = await dbPool.query(
      `
      UPDATE reminder_timers
      SET
        name = $2,
        timer_type = $3,
        cron_expression = $4,
        timezone = $5,
        active = $6,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, timer_type, cron_expression, timezone, active, created_at, updated_at
      `,
      [
        id,
        input.name ?? existing.name,
        input.timerType ?? existing.timerType,
        input.cronExpression ?? existing.cronExpression,
        input.timezone ?? existing.timezone,
        input.active ?? existing.active
      ]
    );

    return mapTimerRow(result.rows[0]);
  }

  async deleteTimer(id: number): Promise<boolean> {
    const result = await dbPool.query(`DELETE FROM reminder_timers WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
