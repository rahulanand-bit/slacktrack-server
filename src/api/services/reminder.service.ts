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
    for (const slackUserId of recipients) {
      if (timer.timerType === 'evening') {
        const user = await this.userRepository.findBySlackId(slackUserId);
        if (user) {
          const hasAttendance = await this.attendanceRepository.hasAttendanceForDate(user.id, dateYmd);
          if (hasAttendance) {
            const shouldSendProjectReminder =
              env.ENABLE_PROJECT_TRACKING &&
              env.PROJECT_MISSING_REMINDER_ENABLED &&
              (env.PROJECT_TRACKING_REQUIRED ||
                env.PROJECT_SPLIT_MODAL_ENABLED ||
                env.PROJECT_SPLIT_CHAT_ENABLED);

            if (shouldSendProjectReminder) {
              const hasProjects = await this.attendanceRepository.hasProjectsForDate(user.id, dateYmd);
              if (!hasProjects) {
                await this.slackApiService.sendProjectReminder(slackUserId, dateYmd);
              }
            }

            continue;
          }
        }
      }

      await this.slackApiService.sendAttendanceActions(slackUserId);
    }
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
