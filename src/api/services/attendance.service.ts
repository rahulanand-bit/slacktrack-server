import { DateTime } from 'luxon';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { JobPublisher } from '../../queues/contracts/job-publisher';
import type { AttendanceUpdateJob, ProjectUpdateJob } from '../../queues/contracts/job-types';
import type { AttendanceRepository } from '../repositories/attendance.repository';
import type { AttendanceValue } from '../repositories/models';
import type { HolidayRepository } from '../repositories/holiday.repository';
import type { UserRepository } from '../repositories/user.repository';

export class AttendanceService {
  constructor(
    private readonly jobPublisher: JobPublisher,
    private readonly userRepository: UserRepository,
    private readonly attendanceRepository: AttendanceRepository,
    private readonly holidayRepository: HolidayRepository
  ) {}

  async enqueueAttendanceUpdate(job: AttendanceUpdateJob): Promise<void> {
    await this.jobPublisher.publishAttendanceUpdate(job);
  }

  async enqueueProjectUpdate(job: ProjectUpdateJob): Promise<void> {
    await this.jobPublisher.publishProjectUpdate(job);
  }

  async processAttendanceUpdate(job: AttendanceUpdateJob): Promise<void> {
    const dateYmd = this.getTodayYmd();
    await this.setAttendanceForDate(job.slackUserId, dateYmd, job.attendanceValue);
    await this.jobPublisher.publishSheetReconcile({ reason: 'manual' });
    logger.info(
      {
        slackUserId: job.slackUserId,
        attendanceValue: job.attendanceValue,
        dateYmd
      },
      'Attendance updated'
    );
  }

  async setAttendanceForDate(
    slackUserId: string,
    dateYmd: string,
    attendanceValue: AttendanceValue
  ): Promise<void> {
    const user = await this.userRepository.upsertBySlackId(slackUserId);
    await this.attendanceRepository.upsertAttendance(user.id, dateYmd, attendanceValue);
  }

  async processProjectUpdate(job: ProjectUpdateJob): Promise<void> {
    await this.setProjectsForDate(job.slackUserId, job.dateYmd, job.projects);
    await this.jobPublisher.publishSheetReconcile({ reason: 'manual' });
    logger.info(
      {
        slackUserId: job.slackUserId,
        dateYmd: job.dateYmd,
        projects: job.projects
      },
      'Project entries updated'
    );
  }

  async setProjectsForDate(slackUserId: string, dateYmd: string, projects: string[]): Promise<void> {
    const user = await this.userRepository.upsertBySlackId(slackUserId);
    const normalizedProjects = AttendanceService.validateProjects(projects, env.MAX_PROJECTS_PER_DAY);
    await this.attendanceRepository.replaceProjects(user.id, dateYmd, normalizedProjects);
  }

  async getProjectsForDate(slackUserId: string, dateYmd: string): Promise<string[]> {
    const user = await this.userRepository.findBySlackId(slackUserId);
    if (!user) return [];
    return this.attendanceRepository.getProjectsForDate(user.id, dateYmd);
  }

  async listDailyAttendance(dateYmd: string): Promise<
    Array<{
      slackUserId: string;
      name: string | null;
      email: string | null;
      isMessageEnabled: boolean;
      dateYmd: string;
      status: AttendanceValue | null;
      projects: string[];
    }>
  > {
    const users = await this.userRepository.listUsers();

    const rows = await Promise.all(
      users.map(async (user) => ({
        slackUserId: user.slackUserId,
        name: user.displayName,
        email: user.email,
        isMessageEnabled: user.isMessageEnabled,
        dateYmd,
        status: await this.attendanceRepository.getAttendanceForDate(user.id, dateYmd),
        projects: await this.attendanceRepository.getProjectsForDate(user.id, dateYmd)
      }))
    );

    return rows;
  }

  async listMonthlyAttendance(month?: string): Promise<{
    month: string;
    dates: string[];
    nonWorkingDates: string[];
    holidayDates: string[];
    weekendDates: string[];
    users: Array<{
      slackUserId: string;
      name: string | null;
      email: string | null;
      isMessageEnabled: boolean;
      days: Array<{ dateYmd: string; status: AttendanceValue | null; projects: string[] }>;
    }>;
  }> {
    const { monthKey, fromDateYmd, toDateYmd, dates } = this.resolveMonthRange(month);
    const [users, snapshotRows] = await Promise.all([
      this.userRepository.listUsers(),
      this.attendanceRepository.listSnapshotRows(fromDateYmd, toDateYmd)
    ]);
    const nonWorkingDates = await this.buildNonWorkingDates(dates);

    const rowMap = new Map(
      snapshotRows.map((row) => [
        `${row.slackUserId}:${row.dateYmd}`,
        { status: row.status, projects: row.projects }
      ])
    );

    return {
      month: monthKey,
      dates,
      nonWorkingDates: nonWorkingDates.nonWorkingDates,
      holidayDates: nonWorkingDates.holidayDates,
      weekendDates: nonWorkingDates.weekendDates,
      users: users.map((user) => ({
        slackUserId: user.slackUserId,
        name: user.displayName,
        email: user.email,
        isMessageEnabled: user.isMessageEnabled,
        days: dates.map((dateYmd) => {
          const key = `${user.slackUserId}:${dateYmd}`;
          const data = rowMap.get(key);
          return {
            dateYmd,
            status: data?.status ?? null,
            projects: data?.projects ?? []
          };
        })
      }))
    };
  }

  async getUserMonthlyAttendance(
    slackUserId: string,
    month?: string
  ): Promise<{
    slackUserId: string;
    name: string | null;
    email: string | null;
    isMessageEnabled: boolean;
    month: string;
    nonWorkingDates: string[];
    holidayDates: string[];
    weekendDates: string[];
    days: Array<{ dateYmd: string; status: AttendanceValue | null; projects: string[] }>;
  } | null> {
    const user = await this.userRepository.findBySlackId(slackUserId);
    if (!user) return null;

    const { monthKey, fromDateYmd, toDateYmd, dates } = this.resolveMonthRange(month);
    const snapshotRows = await this.attendanceRepository.listSnapshotRows(fromDateYmd, toDateYmd);
    const nonWorkingDates = await this.buildNonWorkingDates(dates);
    const userRows = snapshotRows.filter((row) => row.slackUserId === slackUserId);
    const rowMap = new Map(
      userRows.map((row) => [row.dateYmd, { status: row.status, projects: row.projects }])
    );

    return {
      slackUserId: user.slackUserId,
      name: user.displayName,
      email: user.email,
      isMessageEnabled: user.isMessageEnabled,
      month: monthKey,
      nonWorkingDates: nonWorkingDates.nonWorkingDates,
      holidayDates: nonWorkingDates.holidayDates,
      weekendDates: nonWorkingDates.weekendDates,
      days: dates.map((dateYmd) => {
        const data = rowMap.get(dateYmd);
        return {
          dateYmd,
          status: data?.status ?? null,
          projects: data?.projects ?? []
        };
      })
    };
  }

  async getUserAttendanceRange(
    slackUserId: string,
    fromDateYmd: string,
    toDateYmd: string
  ): Promise<{
    slackUserId: string;
    name: string | null;
    email: string | null;
    isMessageEnabled: boolean;
    period: { from: string; to: string };
    nonWorkingDates: string[];
    holidayDates: string[];
    weekendDates: string[];
    days: Array<{ dateYmd: string; status: AttendanceValue | null; projects: string[] }>;
  } | null> {
    const user = await this.userRepository.findBySlackId(slackUserId);
    if (!user) return null;

    const from = DateTime.fromFormat(fromDateYmd, 'yyyy-LL-dd', { zone: env.TIMEZONE }).startOf('day');
    const to = DateTime.fromFormat(toDateYmd, 'yyyy-LL-dd', { zone: env.TIMEZONE }).startOf('day');
    if (!from.isValid || !to.isValid || to < from) {
      throw new Error('Invalid range. Expected from/to in YYYY-MM-DD and to >= from.');
    }

    const dates: string[] = [];
    let cursor = from;
    while (cursor <= to) {
      dates.push(cursor.toFormat('yyyy-LL-dd'));
      cursor = cursor.plus({ days: 1 });
    }

    const snapshotRows = await this.attendanceRepository.listSnapshotRows(fromDateYmd, toDateYmd);
    const nonWorkingDates = await this.buildNonWorkingDates(dates);
    const userRows = snapshotRows.filter((row) => row.slackUserId === slackUserId);
    const rowMap = new Map(
      userRows.map((row) => [row.dateYmd, { status: row.status, projects: row.projects }])
    );

    return {
      slackUserId: user.slackUserId,
      name: user.displayName,
      email: user.email,
      isMessageEnabled: user.isMessageEnabled,
      period: { from: fromDateYmd, to: toDateYmd },
      nonWorkingDates: nonWorkingDates.nonWorkingDates,
      holidayDates: nonWorkingDates.holidayDates,
      weekendDates: nonWorkingDates.weekendDates,
      days: dates.map((dateYmd) => {
        const data = rowMap.get(dateYmd);
        return {
          dateYmd,
          status: data?.status ?? null,
          projects: data?.projects ?? []
        };
      })
    };
  }

  private resolveMonthRange(month?: string): {
    monthKey: string;
    fromDateYmd: string;
    toDateYmd: string;
    dates: string[];
  } {
    const monthStart = month
      ? DateTime.fromFormat(month, 'yyyy-LL', { zone: env.TIMEZONE }).startOf('month')
      : DateTime.now().setZone(env.TIMEZONE).startOf('month');

    if (!monthStart.isValid) {
      throw new Error('Invalid month format. Expected YYYY-MM.');
    }

    const monthEnd = monthStart.endOf('month');
    const dates: string[] = [];
    let cursor = monthStart;
    while (cursor <= monthEnd) {
      dates.push(cursor.toFormat('yyyy-LL-dd'));
      cursor = cursor.plus({ days: 1 });
    }

    return {
      monthKey: monthStart.toFormat('yyyy-LL'),
      fromDateYmd: monthStart.toFormat('yyyy-LL-dd'),
      toDateYmd: monthEnd.toFormat('yyyy-LL-dd'),
      dates
    };
  }

  getTodayYmd(): string {
    return DateTime.now().setZone(env.TIMEZONE).toFormat('yyyy-LL-dd');
  }

  private async buildNonWorkingDates(dates: string[]): Promise<{
    nonWorkingDates: string[];
    holidayDates: string[];
    weekendDates: string[];
  }> {
    const holidays = await this.holidayRepository.listAllDateYmd();
    const holidaySet = new Set(holidays);
    const nonWorking: string[] = [];
    const holidayDates: string[] = [];
    const weekendDates: string[] = [];

    for (const dateYmd of dates) {
      const isWeekend = DateTime.fromFormat(dateYmd, 'yyyy-LL-dd', { zone: env.TIMEZONE }).weekday >= 6;
      const isHoliday = holidaySet.has(dateYmd);
      if (isWeekend) {
        weekendDates.push(dateYmd);
      }
      if (isHoliday) {
        holidayDates.push(dateYmd);
      }
      if (isWeekend || isHoliday) {
        nonWorking.push(dateYmd);
      }
    }

    return { nonWorkingDates: nonWorking, holidayDates, weekendDates };
  }

  static validateProjects(projects: string[], maxProjects: number, required = env.PROJECT_TRACKING_REQUIRED): string[] {
    const normalized = projects.map((project) => project.trim()).filter(Boolean);
    if (required && normalized.length === 0) {
      throw new Error('At least one project is required.');
    }
    if (normalized.length > maxProjects) {
      throw new Error(`Maximum ${maxProjects} projects are allowed per day`);
    }
    return normalized;
  }

  static mapActionToAttendance(actionId?: string): AttendanceValue | null {
    if (actionId === 'wfo') return 'WFO';
    if (actionId === 'wfh') return 'WFH';
    if (actionId === 'leave_full') return '-1';
    if (actionId === 'leave_half') return '-0.5';
    return null;
  }
}
