export type AttendanceValue = 'WFO' | 'WFH' | '-1' | '-0.5';

export type AdminRole = 'admin' | 'hr' | 'manager' | 'analytics';

export type UserRecord = {
  id: number;
  slackUserId: string;
  displayName: string | null;
  email: string | null;
  isMessageEnabled: boolean;
  active: boolean;
  deactivatedAt: Date | null;
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

export type ProjectMonthlyUserStat = {
  slackUserId: string;
  displayName: string | null;
  email: string | null;
  projectName: string;
  daysWorked: number;
};

export type UserProjectMonthlyStat = {
  projectName: string;
  daysWorked: number;
};

export type EmployeeSummaryStat = {
  slackUserId: string;
  displayName: string | null;
  email: string | null;
  activeDays: number;
};

export type ProjectSummaryStat = {
  projectName: string;
  activeDays: number;
};

export type StatusBreakdownStat = {
  status: 'WFO' | 'WFH' | '-1' | '-0.5';
  count: number;
};

export type AnalyticsOverviewStat = {
  activeUsers: number;
  presentCount: number;
  pendingAttendance: number;
  employeesOnLeave: number;
  highLeaveEmployees: number;
  wfhHeavyEmployees: number;
  attendanceCompliancePct: number;
};

export type AnalyticsTrendRow = {
  dateYmd: string;
  wfoCount: number;
  wfhCount: number;
  leaveCount: number;
  halfDayCount: number;
  markedCount: number;
};

export type HighLeaveEmployeeRow = {
  slackUserId: string;
  displayName: string | null;
  email: string | null;
  leaveDays: number;
};

export type WfhHeavyEmployeeRow = {
  slackUserId: string;
  displayName: string | null;
  email: string | null;
  wfhDays: number;
  presentDays: number;
  wfhRatioPct: number;
};

export type WfoBaselineRow = {
  slackUserId: string;
  displayName: string | null;
  email: string | null;
  wfoDays: number;
  meetsBaseline: boolean;
};

export type ProjectContributionRow = {
  projectName: string;
  activeDays: number;
  sharePct: number;
};
