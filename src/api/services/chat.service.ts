import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { JobPublisher } from '../../queues/contracts/job-publisher';
import type { ChatParseJob } from '../../queues/contracts/job-types';
import type { AttendanceService } from './attendance.service';
import type { NlpService } from './nlp.service';
import type { SlackApiService } from './slack-api.service';

export class ChatService {
  constructor(
    private readonly jobPublisher: JobPublisher,
    private readonly nlpService: NlpService,
    private readonly attendanceService: AttendanceService,
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

    if (intent.attendanceValue) {
      await this.attendanceService.setAttendanceForDate(job.slackUserId, intent.dateYmd, intent.attendanceValue);
    }

    if (intent.projects.length > 0) {
      if (!shouldHandleProjects) {
        await this.slackApiService.sendClarification(
          job.channelId,
          'Project tracking via chat is currently disabled.'
        );
      } else {
        await this.attendanceService.setProjectsForDate(job.slackUserId, intent.dateYmd, intent.projects);
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
      `Updated for ${intent.dateYmd}: ${parts.join(' | ')}`
    );

    logger.info({ slackUserId: job.slackUserId, intent }, 'Chat job processed');
  }
}
