import type { Request, Response } from 'express';
import { z } from 'zod';
import type { TimerService } from '../services/timer.service';

const createTimerSchema = z.object({
  name: z.string().min(1),
  timerType: z.enum(['morning', 'evening', 'custom']),
  cronExpression: z.string().min(5),
  timezone: z.string().min(1),
  active: z.boolean().default(true)
});

const updateTimerSchema = createTimerSchema.partial();

export class TimerController {
  constructor(private readonly timerService: TimerService) {}

  async listTimers(_req: Request, res: Response): Promise<void> {
    const timers = await this.timerService.listTimers();
    res.status(200).json({ ok: true, data: timers });
  }

  async createTimer(req: Request, res: Response): Promise<void> {
    const input = createTimerSchema.parse(req.body);
    const timer = await this.timerService.createTimer(input);
    res.status(201).json({ ok: true, data: timer });
  }

  async updateTimer(req: Request, res: Response): Promise<void> {
    const timerId = Number(req.params.id);
    if (!Number.isFinite(timerId) || timerId <= 0) {
      res.status(400).json({ ok: false, error: 'Invalid timer id' });
      return;
    }

    const input = updateTimerSchema.parse(req.body);
    const timer = await this.timerService.updateTimer(timerId, input);
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
}
