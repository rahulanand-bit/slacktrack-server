import { DateTime } from 'luxon';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { JobPublisher } from '../../queues/contracts/job-publisher';
import type { ChatParseJob } from '../../queues/contracts/job-types';
import type { HolidayRepository } from '../repositories/holiday.repository';
import type { AttendanceService } from './attendance.service';
import type { NlpService } from './nlp.service';
import type { SlackApiService } from './slack-api.service';

export class ChatService {
  constructor(
    private readonly jobPublisher: JobPublisher,
    private readonly nlpService: NlpService,
    private readonly attendanceService: AttendanceService,
    private readonly holidayRepository: HolidayRepository,
    private readonly slackApiService: SlackApiService
  ) {}

  async enqueueChatParse(job: ChatParseJob): Promise<void> {
    await this.jobPublisher.publishChatParse(job);
  }

  async processChatJob(job: ChatParseJob): Promise<void> {
    const intent = await this.nlpService.parse(job.text);
    const shouldHandleProjects = env.ENABLE_PROJECT_TRACKING && env.PROJECT_SPLIT_CHAT_ENABLED;

    if (intent.ambiguous) {
      await this.slackApiService.sendClarification(
        job.channelId,
        'I could not understand that. Try: "WFH today" or "Projects today: Alpha, Beta".'
      );
      return;
    }

    let targetDates = intent.dateYmds;
    if (intent.isRange) {
      const holidaySet = new Set(await this.holidayRepository.listAllDateYmd());
      targetDates = targetDates.filter((dateYmd) => !this.isWeekend(dateYmd) && !holidaySet.has(dateYmd));

      if (targetDates.length === 0) {
        await this.slackApiService.sendClarification(
          job.channelId,
          'No working days found in that range (weekends and holidays are skipped).'
        );
        return;
      }
    }

    for (const dateYmd of targetDates) {
      if (intent.attendanceValue) {
        await this.attendanceService.setAttendanceForDate(job.slackUserId, dateYmd, intent.attendanceValue);
      }

      if (intent.projects.length > 0) {
        if (!shouldHandleProjects) {
          await this.slackApiService.sendClarification(
            job.channelId,
            'Project tracking via chat is currently disabled.'
          );
          return;
        }
        await this.attendanceService.setProjectsForDate(job.slackUserId, dateYmd, intent.projects);
      }
    }

    const parts: string[] = [];
    if (intent.attendanceValue) parts.push(`attendance: ${intent.attendanceValue}`);
    if (intent.projects.length > 0 && shouldHandleProjects) parts.push(`projects: ${intent.projects.join(', ')}`);
    if (parts.length === 0) {
      await this.slackApiService.sendClarification(
        job.channelId,
        'I understood the request but no updatable fields were found.'
      );
      return;
    }

    await this.slackApiService.sendClarification(
      job.channelId,
      `Updated for ${this.describeDates(targetDates)}: ${parts.join(' | ')}`
    );

    logger.info({ slackUserId: job.slackUserId, intent }, 'Chat job processed');
  }

  private isWeekend(dateYmd: string): boolean {
    const date = DateTime.fromFormat(dateYmd, 'yyyy-LL-dd', { zone: env.TIMEZONE });
    return date.weekday === 6 || date.weekday === 7;
  }

  private describeDates(dateYmds: string[]): string {
    if (dateYmds.length === 1) return dateYmds[0];
    return `${dateYmds[0]} to ${dateYmds[dateYmds.length - 1]} (${dateYmds.length} days)`;
  }
}
