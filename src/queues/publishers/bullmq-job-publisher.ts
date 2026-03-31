import { Queue, type RepeatableJob } from 'bullmq';
import Redis from 'ioredis';
import { JOB_NAMES, QUEUE_NAMES } from '../../config/constants';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { JobPublisher } from '../contracts/job-publisher';
import type {
  AttendanceUpdateJob,
  ChatParseJob,
  ProjectUpdateJob,
  ReminderDispatchJob,
  SheetReconcileJob,
  TimerSchedulingInput
} from '../contracts/job-types';
import type { TimerSchedulerPort } from '../contracts/timer-scheduler-port';

const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null
});

const attendanceQueue = new Queue(QUEUE_NAMES.ATTENDANCE, { connection: redis });
const projectQueue = new Queue(QUEUE_NAMES.PROJECT, { connection: redis });
const chatQueue = new Queue(QUEUE_NAMES.CHAT, { connection: redis });
const reminderQueue = new Queue(QUEUE_NAMES.REMINDER, { connection: redis });
const syncQueue = new Queue(QUEUE_NAMES.SYNC, { connection: redis });

export const queueRegistry = {
  attendanceQueue,
  projectQueue,
  chatQueue,
  reminderQueue,
  syncQueue,
  redisConnection: redis
};

export class BullMqJobPublisher implements JobPublisher, TimerSchedulerPort {
  async publishAttendanceUpdate(job: AttendanceUpdateJob): Promise<void> {
    await attendanceQueue.add(JOB_NAMES.ATTENDANCE_UPDATE, job, {
      jobId: `attendance-${job.slackUserId}-${job.actionTs}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 500 },
      removeOnComplete: 1000,
      removeOnFail: 5000
    });
  }

  async publishProjectUpdate(job: ProjectUpdateJob): Promise<void> {
    await projectQueue.add(JOB_NAMES.PROJECT_UPDATE, job, {
      jobId: `projects-${job.slackUserId}-${job.dateYmd}-${job.submissionTs}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 500 },
      removeOnComplete: 1000,
      removeOnFail: 5000
    });
  }

  async publishChatParse(job: ChatParseJob): Promise<void> {
    await chatQueue.add(JOB_NAMES.CHAT_PARSE, job, {
      jobId: `chat-${job.slackUserId}-${job.eventTs}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 500 },
      removeOnComplete: 1000,
      removeOnFail: 5000
    });
  }

  async publishReminderDispatch(job: ReminderDispatchJob): Promise<void> {
    await reminderQueue.add(JOB_NAMES.REMINDER_DISPATCH, job, {
      attempts: 3,
      backoff: { type: 'fixed', delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: 5000
    });
  }

  async publishSheetReconcile(job: SheetReconcileJob): Promise<void> {
    await syncQueue.add(JOB_NAMES.SHEET_RECONCILE, job, {
      attempts: 3,
      backoff: { type: 'fixed', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 1000
    });
  }

  async upsertTimerSchedule(timer: TimerSchedulingInput): Promise<void> {
    const repeatId = `timer-${timer.id}`;
    await this.removeMatchingRepeatJobs(reminderQueue, repeatId);
    if (!timer.active) return;

    await reminderQueue.add(
      JOB_NAMES.REMINDER_DISPATCH,
      { timerId: timer.id },
      {
        jobId: repeatId,
        repeat: { pattern: timer.cronExpression, tz: timer.timezone },
        removeOnComplete: 1000,
        removeOnFail: 5000
      }
    );
  }

  async removeTimerSchedule(timerId: number): Promise<void> {
    const repeatId = `timer-${timerId}`;
    await this.removeMatchingRepeatJobs(reminderQueue, repeatId);
  }

  private async removeMatchingRepeatJobs(queue: Queue, repeatId: string): Promise<void> {
    const jobs: RepeatableJob[] = await queue.getRepeatableJobs();
    const matching = jobs.filter(
      (job) => job.id === repeatId || job.key.includes(repeatId) || job.name === JOB_NAMES.REMINDER_DISPATCH
    );

    for (const job of matching) {
      if (!(job.id === repeatId || job.key.includes(repeatId))) continue;
      await queue.removeRepeatableByKey(job.key);
      logger.info({ repeatId, key: job.key }, 'Removed existing repeatable timer job');
    }
  }
}
