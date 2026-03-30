import type { AttendanceValue, ReminderTimerRecord } from '../../api/repositories/models';

export type AttendanceUpdateJob = {
  slackUserId: string;
  attendanceValue: AttendanceValue;
  actionTs: string;
  sourceChannelId?: string;
  sourceMessageTs?: string;
};

export type ProjectUpdateJob = {
  slackUserId: string;
  dateYmd: string;
  projects: string[];
  submissionTs: string;
};

export type ChatParseJob = {
  slackUserId: string;
  channelId: string;
  text: string;
  eventTs: string;
};

export type ReminderDispatchJob = {
  timerId: number;
};

export type SheetReconcileJob = {
  reason: 'periodic' | 'manual';
};

export type QueueJobPayloadMap = {
  'attendance.update': AttendanceUpdateJob;
  'project.update': ProjectUpdateJob;
  'chat.parse': ChatParseJob;
  'reminder.dispatch': ReminderDispatchJob;
  'sheet.reconcile': SheetReconcileJob;
};

export type TimerSchedulingInput = Pick<
  ReminderTimerRecord,
  'id' | 'timerType' | 'cronExpression' | 'timezone' | 'active'
>;
