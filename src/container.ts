import { AttendanceRepository } from './api/repositories/attendance.repository';
import { AdminAuthRepository } from './api/repositories/admin-auth.repository';
import { HolidayRepository } from './api/repositories/holiday.repository';
import { OverrideAuditRepository } from './api/repositories/override-audit.repository';
import { ProjectCatalogRepository } from './api/repositories/project-catalog.repository';
import { SheetSyncRepository } from './api/repositories/sheet-sync.repository';
import { TimerRepository } from './api/repositories/timer.repository';
import { UserRepository } from './api/repositories/user.repository';
import { OverrideController } from './api/controllers/override.controller';
import { AuthController } from './api/controllers/auth.controller';
import { AttendanceAdminController } from './api/controllers/attendance-admin.controller';
import { DashboardController } from './api/controllers/dashboard.controller';
import { HolidayController } from './api/controllers/holiday.controller';
import { ProjectCatalogController } from './api/controllers/project-catalog.controller';
import { SlackController } from './api/controllers/slack.controller';
import { SyncController } from './api/controllers/sync.controller';
import { TimerController } from './api/controllers/timer.controller';
import { UserAdminController } from './api/controllers/user-admin.controller';
import { AttendanceService } from './api/services/attendance.service';
import { AuthService } from './api/services/auth.service';
import { ChatService } from './api/services/chat.service';
import { DashboardService } from './api/services/dashboard.service';
import { HolidayService } from './api/services/holiday.service';
import { NlpService } from './api/services/nlp.service';
import { OverrideService } from './api/services/override.service';
import { ProjectCatalogService } from './api/services/project-catalog.service';
import { ReminderService } from './api/services/reminder.service';
import { SheetSyncService } from './api/services/sheet-sync.service';
import { SlackApiService } from './api/services/slack-api.service';
import { TimerService } from './api/services/timer.service';
import { UserAdminService } from './api/services/user-admin.service';
import { BullMqJobPublisher } from './queues/publishers/bullmq-job-publisher';
import { GoogleSheetWriter } from './sheets/google-sheet.writer';
import { cacheRedis } from './config/cache';

const userRepository = new UserRepository();
const adminAuthRepository = new AdminAuthRepository();
const attendanceRepository = new AttendanceRepository();
const projectCatalogRepository = new ProjectCatalogRepository();
const holidayRepository = new HolidayRepository();
const overrideAuditRepository = new OverrideAuditRepository();
const sheetSyncRepository = new SheetSyncRepository();
const timerRepository = new TimerRepository();
const slackApiService = new SlackApiService();
const nlpService = new NlpService();
const sheetWriter = new GoogleSheetWriter();

const jobPublisher = new BullMqJobPublisher();

const attendanceService = new AttendanceService(jobPublisher, userRepository, attendanceRepository);
const authService = new AuthService(adminAuthRepository);
const projectCatalogService = new ProjectCatalogService(projectCatalogRepository, cacheRedis);
const chatService = new ChatService(jobPublisher, nlpService, attendanceService, holidayRepository, slackApiService);
const holidayService = new HolidayService(holidayRepository);
const overrideService = new OverrideService(
  userRepository,
  attendanceRepository,
  overrideAuditRepository,
  jobPublisher
);
const reminderService = new ReminderService(
  timerRepository,
  holidayRepository,
  userRepository,
  attendanceRepository,
  slackApiService
);
const timerService = new TimerService(timerRepository, jobPublisher);
const userAdminService = new UserAdminService(userRepository);
const sheetSyncService = new SheetSyncService(
  attendanceRepository,
  sheetSyncRepository,
  userRepository,
  sheetWriter,
  jobPublisher
);
const dashboardService = new DashboardService(attendanceService, timerRepository, overrideAuditRepository);

const slackController = new SlackController(attendanceService, chatService, projectCatalogService, slackApiService);
const authController = new AuthController(authService);
const attendanceAdminController = new AttendanceAdminController(attendanceService);
const dashboardController = new DashboardController(dashboardService);
const holidayController = new HolidayController(holidayService);
const projectCatalogController = new ProjectCatalogController(projectCatalogService);
const overrideController = new OverrideController(overrideService);
const syncController = new SyncController(sheetSyncService);
const timerController = new TimerController(timerService, reminderService);
const userAdminController = new UserAdminController(userAdminService);

export const container = {
  repositories: {
    userRepository,
    adminAuthRepository,
    attendanceRepository,
    projectCatalogRepository,
    holidayRepository,
    overrideAuditRepository,
    sheetSyncRepository,
    timerRepository
  },
  services: {
    attendanceService,
    authService,
    projectCatalogService,
    chatService,
    nlpService,
    overrideService,
    reminderService,
    timerService,
    userAdminService,
    sheetSyncService,
    dashboardService,
    holidayService,
    slackApiService
  },
  controllers: {
    authController,
    attendanceAdminController,
    dashboardController,
    holidayController,
    projectCatalogController,
    slackController,
    overrideController,
    syncController,
    timerController,
    userAdminController
  }
};
