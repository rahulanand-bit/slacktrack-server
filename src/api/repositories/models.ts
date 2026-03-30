export type AttendanceValue = 'WFO' | 'WFH' | '-1' | '-0.5';

export type AdminRole = 'admin' | 'hr' | 'manager';

export type UserRecord = {
  id: number;
  slackUserId: string;
  displayName: string | null;
  email: string | null;
  isMessageEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AttendanceRecord = {
  id: number;
  userId: number;
  dateYmd: string;
  status: AttendanceValue;
  updatedAt: Date;
};

export type ProjectEntryRecord = {
  id: number;
  userId: number;
  dateYmd: string;
  slotIndex: number;
  projectName: string;
};

export type ProjectCatalogRecord = {
  id: number;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AttendanceProjectSnapshotRow = {
  slackUserId: string;
  displayName: string | null;
  dateYmd: string;
  status: AttendanceValue | null;
  projects: string[];
};

export type ReminderTimerRecord = {
  id: number;
  name: string;
  timerType: 'morning' | 'evening' | 'custom';
  cronExpression: string;
  timezone: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminUserRecord = {
  id: number;
  email: string;
  passwordHash: string;
  role: AdminRole;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};
