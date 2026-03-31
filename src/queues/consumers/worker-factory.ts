import { Worker, type Job } from 'bullmq';
import { JOB_NAMES, QUEUE_NAMES } from '../../config/constants';
import { logger } from '../../config/logger';
import { queueRegistry } from '../publishers/bullmq-job-publisher';
import { container } from '../../container';
import type {
  AttendanceUpdateJob,
  ChatParseJob,
  ProjectUpdateJob,
  ReminderDispatchJob,
  SheetReconcileJob
} from '../contracts/job-types';

export function createWorkers(): Worker[] {
  const attendanceWorker = new Worker(
    QUEUE_NAMES.ATTENDANCE,
    async (job: Job<AttendanceUpdateJob>) => {
      if (job.name !== JOB_NAMES.ATTENDANCE_UPDATE) return;
      await container.services.attendanceService.processAttendanceUpdate(job.data);
    },
    { connection: queueRegistry.redisConnection }
  );

  attendanceWorker.on('failed', async (job, err) => {
    if (!job || job.name !== JOB_NAMES.ATTENDANCE_UPDATE) return;
    const maxAttempts = job.opts.attempts || 1;
    const terminalFailure = job.attemptsMade >= maxAttempts;
    logger.error(
      {
        jobId: job.id,
        attemptsMade: job.attemptsMade,
        maxAttempts,
        error: err.message
      },
      'Attendance job failed'
    );

    if (!terminalFailure) return;
    await container.services.slackApiService.updateAttendanceMessageState({
      channelId: job.data.sourceChannelId,
      messageTs: job.data.sourceMessageTs,
      selectedAttendanceActionId: mapAttendanceValueToActionId(job.data.attendanceValue),
      projectSelected: Boolean(job.data.projectSelected),
      failed: true
    });
    await container.services.slackApiService.notifyAttendanceFailure(
      job.data.slackUserId,
      job.data.attendanceValue,
      err.message
    );
  });

  attendanceWorker.on('completed', async (job) => {
    if (!job || job.name !== JOB_NAMES.ATTENDANCE_UPDATE) return;
    await container.services.slackApiService.updateAttendanceMessageState({
      channelId: job.data.sourceChannelId,
      messageTs: job.data.sourceMessageTs,
      selectedAttendanceActionId: mapAttendanceValueToActionId(job.data.attendanceValue),
      projectSelected: Boolean(job.data.projectSelected),
      failed: false
    });
  });

  const chatWorker = new Worker(
    QUEUE_NAMES.CHAT,
    async (job: Job<ChatParseJob>) => {
      if (job.name !== JOB_NAMES.CHAT_PARSE) return;
      await container.services.chatService.processChatJob(job.data);
    },
    { connection: queueRegistry.redisConnection }
  );

  const projectWorker = new Worker(
    QUEUE_NAMES.PROJECT,
    async (job: Job<ProjectUpdateJob>) => {
      if (job.name !== JOB_NAMES.PROJECT_UPDATE) return;
      await container.services.attendanceService.processProjectUpdate(job.data);
    },
    { connection: queueRegistry.redisConnection }
  );

  projectWorker.on('failed', async (job) => {
    if (!job || job.name !== JOB_NAMES.PROJECT_UPDATE) return;
    await container.services.slackApiService.updateAttendanceMessageState({
      channelId: job.data.sourceChannelId,
      messageTs: job.data.sourceMessageTs,
      selectedAttendanceActionId: job.data.selectedAttendanceActionId,
      projectSelected: false,
      failed: true,
      text: 'Project update failed. Please retry.'
    });
  });

  projectWorker.on('completed', async (job) => {
    if (!job || job.name !== JOB_NAMES.PROJECT_UPDATE) return;
    await container.services.slackApiService.updateAttendanceMessageState({
      channelId: job.data.sourceChannelId,
      messageTs: job.data.sourceMessageTs,
      selectedAttendanceActionId: job.data.selectedAttendanceActionId,
      projectSelected: true,
      failed: false,
      text: 'Projects updated.'
    });
  });

  const reminderWorker = new Worker(
    QUEUE_NAMES.REMINDER,
    async (job: Job<ReminderDispatchJob>) => {
      if (job.name !== JOB_NAMES.REMINDER_DISPATCH) return;
      await container.services.reminderService.dispatchByTimer(job.data.timerId);
    },
    { connection: queueRegistry.redisConnection }
  );

  const syncWorker = new Worker(
    QUEUE_NAMES.SYNC,
    async (job: Job<SheetReconcileJob>) => {
      if (job.name !== JOB_NAMES.SHEET_RECONCILE) return;
      await container.services.sheetSyncService.reconcile(job.data.reason);
    },
    { connection: queueRegistry.redisConnection }
  );

  return [attendanceWorker, projectWorker, chatWorker, reminderWorker, syncWorker];
}

function mapAttendanceValueToActionId(
  value: AttendanceUpdateJob['attendanceValue']
): 'wfo' | 'wfh' | 'leave_full' | 'leave_half' {
  if (value === 'WFO') return 'wfo';
  if (value === 'WFH') return 'wfh';
  if (value === '-1') return 'leave_full';
  return 'leave_half';
}
