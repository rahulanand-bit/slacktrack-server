import { DateTime } from 'luxon';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { slackUserNotificationSeed } from '../../config/slack-user-notification.seed';
import type { AttendanceRepository } from '../repositories/attendance.repository';
import type { HolidayRepository } from '../repositories/holiday.repository';
import type { TimerRepository } from '../repositories/timer.repository';
import type { UserRepository } from '../repositories/user.repository';
import type { SlackApiService } from './slack-api.service';

export function isWeekend(weekday: number): boolean {
  return weekday === 6 || weekday === 7;
}

export class ReminderService {
  constructor(
    private readonly timerRepository: TimerRepository,
    private readonly holidayRepository: HolidayRepository,
    private readonly userRepository: UserRepository,
    private readonly attendanceRepository: AttendanceRepository,
    private readonly slackApiService: SlackApiService
  ) {}

  async dispatchByTimer(timerId: number): Promise<void> {
    const timer = await this.timerRepository.getTimerById(timerId);
    if (!timer || !timer.active) {
      logger.info({ timerId }, 'Skipping reminder dispatch for inactive/missing timer');
      return;
    }

    const now = DateTime.now().setZone(timer.timezone || env.TIMEZONE);
    const dateYmd = now.toFormat('yyyy-LL-dd');
    const weekend = isWeekend(now.weekday);
    const holiday = await this.holidayRepository.isHoliday(dateYmd);
    if (weekend || holiday) {
      logger.info({ timerId, dateYmd, weekend, holiday }, 'Skipping reminder on non-working day');
      return;
    }

    const recipients = await this.resolveReminderRecipients();
    const shouldSendProjectReminder =
      timer.timerType === 'evening' &&
      env.ENABLE_PROJECT_TRACKING &&
      env.PROJECT_MISSING_REMINDER_ENABLED &&
      (env.PROJECT_TRACKING_REQUIRED || env.PROJECT_SPLIT_MODAL_ENABLED || env.PROJECT_SPLIT_CHAT_ENABLED);

    for (const slackUserId of recipients) {
      const user = await this.userRepository.findBySlackId(slackUserId);
      if (user) {
        const hasAttendance = await this.attendanceRepository.hasAttendanceForDate(user.id, dateYmd);
        if (hasAttendance) {
          if (shouldSendProjectReminder) {
            const hasProjects = await this.attendanceRepository.hasProjectsForDate(user.id, dateYmd);
            if (!hasProjects) {
              await this.slackApiService.sendProjectReminder(slackUserId, dateYmd);
            }
          }

          continue;
        }
      }

      await this.slackApiService.sendAttendanceActions(slackUserId);
    }
  }

  async sendManualAttendanceReminder(slackUserIds?: string[]): Promise<number> {
    const dateYmd = DateTime.now().setZone(env.TIMEZONE).toFormat('yyyy-LL-dd');

    const selectedRecipients = Array.isArray(slackUserIds)
      ? Array.from(new Set(slackUserIds.map((id) => id.trim()).filter(Boolean)))
      : [];

    const recipients =
      selectedRecipients.length > 0
        ? selectedRecipients
        : await this.resolveRecipientsWithoutAttendance(dateYmd);

    for (const recipient of recipients) {
      await this.slackApiService.sendAttendanceActions(recipient);
    }

    return recipients.length;
  }

  private async resolveRecipientsWithoutAttendance(dateYmd: string): Promise<string[]> {
    const allRecipients = await this.resolveReminderRecipients();

    const checks = await Promise.all(
      allRecipients.map(async (slackUserId) => {
        const user = await this.userRepository.findBySlackId(slackUserId);
        if (!user) {
          return slackUserId;
        }

        const hasAttendance = await this.attendanceRepository.hasAttendanceForDate(user.id, dateYmd);
        return hasAttendance ? null : slackUserId;
      })
    );

    return checks.filter((value): value is string => Boolean(value));
  }

  private async resolveReminderRecipients(): Promise<string[]> {
    const messageEnabledUsers = await this.userRepository.listMessageEnabledSlackUserIds();
    if (messageEnabledUsers.length) return messageEnabledUsers;

    if (slackUserNotificationSeed.length) {
      return slackUserNotificationSeed
        .filter((user) => user.isMessageEnabled)
        .map((user) => user.slackId);
    }

    return this.userRepository.listAllSlackUserIds();
  }
}
