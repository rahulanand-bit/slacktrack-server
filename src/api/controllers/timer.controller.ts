import type { Request, Response } from 'express';
import {
  createTimerSchema,
  manualAttendanceReminderSchema,
  updateTimerSchema
} from '../schemas/timer.schema';
import type { ReminderService } from '../services/reminder.service';
import type { TimerService } from '../services/timer.service';

export class TimerController {
  constructor(
    private readonly timerService: TimerService,
    private readonly reminderService: ReminderService
  ) {}

  async listTimers(_req: Request, res: Response): Promise<void> {
    const timers = await this.timerService.listTimers();
    res.status(200).json({ ok: true, data: timers });
  }

  async createTimer(req: Request, res: Response): Promise<void> {
    const input = createTimerSchema.parse(req.body);
    const { time, ...rest } = input;
    const timer = await this.timerService.createTimer({
      ...rest,
      cronExpression: input.cronExpression || toDailyCron(time as string)
    });
    res.status(201).json({ ok: true, data: timer });
  }

  async updateTimer(req: Request, res: Response): Promise<void> {
    const timerId = Number(req.params.id);
    if (!Number.isFinite(timerId) || timerId <= 0) {
      res.status(400).json({ ok: false, error: 'Invalid timer id' });
      return;
    }

    const input = updateTimerSchema.parse(req.body);
    const { time, ...rest } = input;
    const timer = await this.timerService.updateTimer(timerId, {
      ...rest,
      cronExpression: time ? toDailyCron(time) : input.cronExpression
    });
    if (!timer) {
      res.status(404).json({ ok: false, error: 'Timer not found' });
      return;
    }

    res.status(200).json({ ok: true, data: timer });
  }

  async deleteTimer(req: Request, res: Response): Promise<void> {
    const timerId = Number(req.params.id);
    if (!Number.isFinite(timerId) || timerId <= 0) {
      res.status(400).json({ ok: false, error: 'Invalid timer id' });
      return;
    }

    const deleted = await this.timerService.deleteTimer(timerId);
    if (!deleted) {
      res.status(404).json({ ok: false, error: 'Timer not found' });
      return;
    }

    res.status(200).json({ ok: true });
  }

  async triggerAttendanceReminder(req: Request, res: Response): Promise<void> {
    const input = manualAttendanceReminderSchema.parse(req.body || {});
    const count = await this.reminderService.sendManualAttendanceReminder(input.slackUserIds);
    res.status(202).json({ ok: true, message: 'Attendance reminder sent', data: { recipients: count } });
  }
}

function toDailyCron(time: string): string {
  const [hours, minutes] = time.split(':');
  return `${Number(minutes)} ${Number(hours)} * * *`;
}
