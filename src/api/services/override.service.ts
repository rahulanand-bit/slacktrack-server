import { env } from '../../config/env';
import type { JobPublisher } from '../../queues/contracts/job-publisher';
import type { AttendanceRepository } from '../repositories/attendance.repository';
import type { AttendanceValue } from '../repositories/models';
import type { OverrideAuditRepository } from '../repositories/override-audit.repository';
import type { UserRepository } from '../repositories/user.repository';

export class OverrideService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly attendanceRepository: AttendanceRepository,
    private readonly overrideAuditRepository: OverrideAuditRepository,
    private readonly jobPublisher: JobPublisher
  ) {}

  async overrideAttendance(input: {
    slackUserId: string;
    dateYmd: string;
    status: AttendanceValue;
    actorId: string;
  }): Promise<void> {
    const user = await this.userRepository.upsertBySlackId(input.slackUserId);
    await this.attendanceRepository.upsertAttendance(user.id, input.dateYmd, input.status);

    await this.overrideAuditRepository.insertAudit({
      overrideType: 'attendance',
      slackUserId: input.slackUserId,
      dateYmd: input.dateYmd,
      payloadJson: { status: input.status },
      actorId: input.actorId
    });

    await this.jobPublisher.publishSheetReconcile({ reason: 'manual' });
  }

  async overrideProjects(input: {
    slackUserId: string;
    dateYmd: string;
    projects: string[];
    actorId: string;
  }): Promise<void> {
    const user = await this.userRepository.upsertBySlackId(input.slackUserId);
    const projects = this.validateProjects(input.projects);
    await this.attendanceRepository.replaceProjects(user.id, input.dateYmd, projects);

    await this.overrideAuditRepository.insertAudit({
      overrideType: 'projects',
      slackUserId: input.slackUserId,
      dateYmd: input.dateYmd,
      payloadJson: { projects },
      actorId: input.actorId
    });

    await this.jobPublisher.publishSheetReconcile({ reason: 'manual' });
  }

  private validateProjects(projects: string[]): string[] {
    const normalized = projects.map((value) => value.trim()).filter(Boolean);
    if (normalized.length > env.MAX_PROJECTS_PER_DAY) {
      throw new Error(`Maximum ${env.MAX_PROJECTS_PER_DAY} projects are allowed per day`);
    }
    return normalized;
  }
}
