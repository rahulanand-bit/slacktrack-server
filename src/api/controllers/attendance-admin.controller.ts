import { DateTime } from 'luxon';
import type { Request, Response } from 'express';
import { env } from '../../config/env';
import {
  attendanceMonthQuerySchema,
  attendanceQuerySchema
} from '../schemas/attendance-admin.schema';
import type { AttendanceService } from '../services/attendance.service';

export class AttendanceAdminController {
  constructor(private readonly attendanceService: AttendanceService) {}

  async listAttendance(req: Request, res: Response): Promise<void> {
    const { dateYmd } = attendanceQuerySchema.parse(req.query);
    const targetDate = dateYmd || DateTime.now().setZone(env.TIMEZONE).toFormat('yyyy-LL-dd');
    const rows = await this.attendanceService.listDailyAttendance(targetDate);
    res.status(200).json({ ok: true, data: rows });
  }

  async listMonthlyAttendance(req: Request, res: Response): Promise<void> {
    const { month } = attendanceMonthQuerySchema.parse(req.query);
    const data = await this.attendanceService.listMonthlyAttendance(month);
    res.status(200).json({ ok: true, data });
  }

  async getUserMonthlyAttendance(req: Request, res: Response): Promise<void> {
    const slackUserId = String(req.params.slackUserId || '').trim();
    if (!slackUserId) {
      res.status(400).json({ ok: false, error: 'Invalid slack user id' });
      return;
    }

    const { month } = attendanceMonthQuerySchema.parse(req.query);
    const data = await this.attendanceService.getUserMonthlyAttendance(slackUserId, month);
    if (!data) {
      res.status(404).json({ ok: false, error: 'User not found' });
      return;
    }

    res.status(200).json({ ok: true, data });
  }
}
