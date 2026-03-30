import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requirePermission } from '../middlewares/admin-rbac.middleware';
import type { AttendanceAdminController } from '../controllers/attendance-admin.controller';

export function createAttendanceRouter(controller: AttendanceAdminController): Router {
  const router = Router();
  router.get(
    '/attendance',
    requirePermission('attendance:read'),
    asyncHandler(controller.listAttendance.bind(controller))
  );
  router.get(
    '/attendance/month',
    requirePermission('attendance:read'),
    asyncHandler(controller.listMonthlyAttendance.bind(controller))
  );
  router.get(
    '/attendance/users/:slackUserId/month',
    requirePermission('attendance:read'),
    asyncHandler(controller.getUserMonthlyAttendance.bind(controller))
  );
  return router;
}
