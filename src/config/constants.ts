export const ATTENDANCE_ACTION_TO_VALUE: Record<string, 'WFO' | 'WFH' | '-1' | '-0.5'> = {
  wfo: 'WFO',
  wfh: 'WFH',
  leave_full: '-1',
  leave_half: '-0.5'
};

export const HOLIDAY_YMD_2026 = [
  '2026-01-01',
  '2026-01-26',
  '2026-03-04',
  '2026-03-19',
  '2026-04-03',
  '2026-09-14',
  '2026-10-02',
  '2026-10-20',
  '2026-11-09',
  '2026-12-25'
];

export const QUEUE_NAMES = {
  ATTENDANCE: 'attendance-jobs',
  PROJECT: 'project-jobs',
  CHAT: 'chat-jobs',
  REMINDER: 'reminder-jobs',
  SYNC: 'sheet-sync-jobs'
} as const;

export const JOB_NAMES = {
  ATTENDANCE_UPDATE: 'attendance.update',
  PROJECT_UPDATE: 'project.update',
  CHAT_PARSE: 'chat.parse',
  REMINDER_DISPATCH: 'reminder.dispatch',
  SHEET_RECONCILE: 'sheet.reconcile'
} as const;
