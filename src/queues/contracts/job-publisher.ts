import type {
  AttendanceUpdateJob,
  ChatParseJob,
  ProjectUpdateJob,
  ReminderDispatchJob,
  SheetReconcileJob
} from './job-types';

export interface JobPublisher {
  publishAttendanceUpdate(job: AttendanceUpdateJob): Promise<void>;
  publishProjectUpdate(job: ProjectUpdateJob): Promise<void>;
  publishChatParse(job: ChatParseJob): Promise<void>;
  publishReminderDispatch(job: ReminderDispatchJob): Promise<void>;
  publishSheetReconcile(job: SheetReconcileJob): Promise<void>;
}
