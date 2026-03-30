import { describe, expect, it, vi } from 'vitest';
import { TimerService } from '../../src/api/services/timer.service';
import type {
  CreateTimerInput,
  TimerRepository,
  UpdateTimerInput
} from '../../src/api/repositories/timer.repository';
import type { ReminderTimerRecord } from '../../src/api/repositories/models';
import type { TimerSchedulerPort } from '../../src/queues/contracts/timer-scheduler-port';

function buildTimerRecord(overrides?: Partial<ReminderTimerRecord>): ReminderTimerRecord {
  return {
    id: 1,
    name: 'Morning Reminder',
    timerType: 'morning',
    cronExpression: '0 9 * * *',
    timezone: 'Asia/Kolkata',
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

describe('TimerService', () => {
  it('creates timer and schedules it', async () => {
    const repo: Pick<TimerRepository, 'createTimer'> = {
      createTimer: vi.fn(async (input: CreateTimerInput) => buildTimerRecord({ name: input.name }))
    };
    const scheduler: TimerSchedulerPort = {
      upsertTimerSchedule: vi.fn(async () => undefined),
      removeTimerSchedule: vi.fn(async () => undefined)
    };

    const service = new TimerService(
      {
        ...repo,
        listTimers: vi.fn(),
        updateTimer: vi.fn(),
        deleteTimer: vi.fn(),
        listActiveTimers: vi.fn()
      } as unknown as TimerRepository,
      scheduler
    );

    const created = await service.createTimer({
      name: 'Morning Reminder',
      timerType: 'morning',
      cronExpression: '0 9 * * *',
      timezone: 'Asia/Kolkata',
      active: true
    });

    expect(created.name).toBe('Morning Reminder');
    expect(scheduler.upsertTimerSchedule).toHaveBeenCalledTimes(1);
  });

  it('throws on invalid cron expression', async () => {
    const service = new TimerService(
      {
        listTimers: vi.fn(),
        createTimer: vi.fn(),
        updateTimer: vi.fn(),
        deleteTimer: vi.fn(),
        listActiveTimers: vi.fn()
      } as unknown as TimerRepository,
      {
        upsertTimerSchedule: vi.fn(async () => undefined),
        removeTimerSchedule: vi.fn(async () => undefined)
      }
    );

    const action = service.createTimer({
      name: 'Bad Cron',
      timerType: 'custom',
      cronExpression: '0 9 *',
      timezone: 'Asia/Kolkata',
      active: true
    });

    await expect(action).rejects.toThrow('Invalid cron expression');
  });

  it('updates timer and re-schedules', async () => {
    const updated = buildTimerRecord({ id: 42, cronExpression: '0 10 * * *' });
    const repo = {
      listTimers: vi.fn(),
      createTimer: vi.fn(),
      updateTimer: vi.fn(async (id: number, input: UpdateTimerInput) => {
        void id;
        void input;
        return updated;
      }),
      deleteTimer: vi.fn(),
      listActiveTimers: vi.fn()
    } as unknown as TimerRepository;
    const scheduler = {
      upsertTimerSchedule: vi.fn(async () => undefined),
      removeTimerSchedule: vi.fn(async () => undefined)
    };

    const service = new TimerService(repo, scheduler);
    const result = await service.updateTimer(42, { cronExpression: '0 10 * * *' });

    expect(result?.id).toBe(42);
    expect(scheduler.upsertTimerSchedule).toHaveBeenCalledTimes(1);
  });
});
