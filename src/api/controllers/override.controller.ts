import type { Request, Response } from 'express';
import { z } from 'zod';
import type { AttendanceValue } from '../repositories/models';
import type { OverrideService } from '../services/override.service';

const attendanceOverrideSchema = z.object({
  slackUserId: z.string().min(1),
  dateYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['WFO', 'WFH', '-1', '-0.5'])
});

const projectsOverrideSchema = z.object({
  slackUserId: z.string().min(1),
  dateYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  projects: z.array(z.string()).max(3)
});

export class OverrideController {
  constructor(private readonly overrideService: OverrideService) {}

  async overrideAttendance(req: Request, res: Response): Promise<void> {
    const input = attendanceOverrideSchema.parse(req.body);
    await this.overrideService.overrideAttendance({
      slackUserId: input.slackUserId,
      dateYmd: input.dateYmd,
      status: input.status as AttendanceValue,
      actorId: req.adminAuth?.actorId || 'unknown'
    });

    res.status(200).json({ ok: true });
  }

  async overrideProjects(req: Request, res: Response): Promise<void> {
    const input = projectsOverrideSchema.parse(req.body);
    await this.overrideService.overrideProjects({
      slackUserId: input.slackUserId,
      dateYmd: input.dateYmd,
      projects: input.projects,
      actorId: req.adminAuth?.actorId || 'unknown'
    });

    res.status(200).json({ ok: true });
  }
}
