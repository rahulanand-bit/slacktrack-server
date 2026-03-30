import { DateTime } from 'luxon';
import { env } from '../../config/env';
import type { AttendanceService } from './attendance.service';
import type { OverrideAuditRepository } from '../repositories/override-audit.repository';
import type { TimerRepository } from '../repositories/timer.repository';

export class DashboardService {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly timerRepository: TimerRepository,
    private readonly overrideAuditRepository: OverrideAuditRepository
  ) {}

  async getSummary(): Promise<{
    activeUsers: number;
    messagingEnabled: number;
    pendingAttendance: number;
    overridesToday: number;
    activeTimers: number;
    dateYmd: string;
  }> {
    const dateYmd = DateTime.now().setZone(env.TIMEZONE).toFormat('yyyy-LL-dd');

    const [dailyAttendance, activeTimers, overridesToday] = await Promise.all([
      this.attendanceService.listDailyAttendance(dateYmd),
      this.timerRepository.listActiveTimers(),
      this.overrideAuditRepository.countByDate(dateYmd)
    ]);

    const activeUsers = dailyAttendance.length;
    const messagingEnabled = dailyAttendance.filter((row) => row.isMessageEnabled).length;
    const pendingAttendance = dailyAttendance.filter((row) => row.status === null).length;

    return {
      activeUsers,
      messagingEnabled,
      pendingAttendance,
      overridesToday,
      activeTimers: activeTimers.length,
      dateYmd
    };
  }
}
