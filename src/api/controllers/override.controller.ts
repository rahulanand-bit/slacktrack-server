import type { Request, Response } from 'express';
import type { AttendanceValue } from '../repositories/models';
import { attendanceOverrideSchema, projectsOverrideSchema } from '../schemas/override.schema';
import type { OverrideService } from '../services/override.service';

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
