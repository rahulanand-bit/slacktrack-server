import type {
  CreateTimerInput,
  TimerRepository,
  UpdateTimerInput
} from '../repositories/timer.repository';
import type { ReminderTimerRecord } from '../repositories/models';
import type { TimerSchedulerPort } from '../../queues/contracts/timer-scheduler-port';

const CRON_PARTS = 5;

export class TimerService {
  constructor(
    private readonly timerRepository: TimerRepository,
    private readonly timerScheduler: TimerSchedulerPort
  ) {}

  async listTimers(): Promise<ReminderTimerRecord[]> {
    return this.timerRepository.listTimers();
  }

  async createTimer(input: CreateTimerInput): Promise<ReminderTimerRecord> {
    this.validateCron(input.cronExpression);
    const timer = await this.timerRepository.createTimer(input);
    await this.timerScheduler.upsertTimerSchedule(timer);
    return timer;
  }

  async updateTimer(id: number, input: UpdateTimerInput): Promise<ReminderTimerRecord | null> {
    if (input.cronExpression) {
      this.validateCron(input.cronExpression);
    }
    const timer = await this.timerRepository.updateTimer(id, input);
    if (!timer) return null;
    await this.timerScheduler.upsertTimerSchedule(timer);
    return timer;
  }

  async deleteTimer(id: number): Promise<boolean> {
    const deleted = await this.timerRepository.deleteTimer(id);
    if (deleted) {
      await this.timerScheduler.removeTimerSchedule(id);
    }
    return deleted;
  }

  async syncSchedulesOnStartup(): Promise<void> {
    const activeTimers = await this.timerRepository.listActiveTimers();
    for (const timer of activeTimers) {
      await this.timerScheduler.upsertTimerSchedule(timer);
    }
  }

  private validateCron(cronExpression: string): void {
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length !== CRON_PARTS) {
      throw new Error('Invalid cron expression. Expected 5 fields.');
    }
  }
}
