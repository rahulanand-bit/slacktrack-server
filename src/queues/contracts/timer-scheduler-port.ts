import type { TimerSchedulingInput } from './job-types';

export interface TimerSchedulerPort {
  upsertTimerSchedule(timer: TimerSchedulingInput): Promise<void>;
  removeTimerSchedule(timerId: number): Promise<void>;
}
