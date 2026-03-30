import { DateTime } from 'luxon';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { JobPublisher } from '../../queues/contracts/job-publisher';
import type { AttendanceUpdateJob, ProjectUpdateJob } from '../../queues/contracts/job-types';
import type { AttendanceRepository } from '../repositories/attendance.repository';
import type { AttendanceValue } from '../repositories/models';
import type { UserRepository } from '../repositories/user.repository';

export class AttendanceService {
  constructor(
    private readonly jobPublisher: JobPublisher,
    private readonly userRepository: UserRepository,
    private readonly attendanceRepository: AttendanceRepository
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

  getTodayYmd(): string {
    return DateTime.now().setZone(env.TIMEZONE).toFormat('yyyy-LL-dd');
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
