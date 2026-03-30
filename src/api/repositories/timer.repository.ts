import { prisma } from '../../config/prisma';
import type { ReminderTimerRecord } from './models';

export type CreateTimerInput = {
  name: string;
  timerType: 'morning' | 'evening' | 'custom';
  cronExpression: string;
  timezone: string;
  active: boolean;
};

export type UpdateTimerInput = Partial<CreateTimerInput>;

function mapTimer(row: {
  id: bigint;
  name: string;
  timerType: string;
  cronExpression: string;
  timezone: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ReminderTimerRecord {
  return {
    id: Number(row.id),
    name: row.name,
    timerType: row.timerType as ReminderTimerRecord['timerType'],
    cronExpression: row.cronExpression,
    timezone: row.timezone,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export class TimerRepository {
  async listTimers(): Promise<ReminderTimerRecord[]> {
    const rows = await prisma.reminderTimer.findMany({ orderBy: { id: 'asc' } });
    return rows.map((row) => mapTimer(row));
  }

  async listActiveTimers(): Promise<ReminderTimerRecord[]> {
    const rows = await prisma.reminderTimer.findMany({ where: { active: true }, orderBy: { id: 'asc' } });
    return rows.map((row) => mapTimer(row));
  }

  async getTimerById(id: number): Promise<ReminderTimerRecord | null> {
    const row = await prisma.reminderTimer.findUnique({ where: { id: BigInt(id) } });
    if (!row) return null;
    return mapTimer(row);
  }

  async createTimer(input: CreateTimerInput): Promise<ReminderTimerRecord> {
    const row = await prisma.reminderTimer.create({ data: input });
    return mapTimer(row);
  }

  async updateTimer(id: number, input: UpdateTimerInput): Promise<ReminderTimerRecord | null> {
    const existing = await prisma.reminderTimer.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return null;

    const updated = await prisma.reminderTimer.update({
      where: { id: BigInt(id) },
      data: {
        name: input.name ?? existing.name,
        timerType: input.timerType ?? existing.timerType,
        cronExpression: input.cronExpression ?? existing.cronExpression,
        timezone: input.timezone ?? existing.timezone,
        active: input.active ?? existing.active,
        updatedAt: new Date()
      }
    });

    return mapTimer(updated);
  }

  async deleteTimer(id: number): Promise<boolean> {
    const deleted = await prisma.reminderTimer.deleteMany({ where: { id: BigInt(id) } });
    return deleted.count > 0;
  }
}
