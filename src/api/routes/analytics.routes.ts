import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requirePermission } from '../middlewares/admin-rbac.middleware';
import type { AnalyticsController } from '../controllers/analytics.controller';

export function createAnalyticsRouter(controller: AnalyticsController): Router {
  const router = Router();
  router.get(
    '/analytics/projects',
    requirePermission('analytics:read'),
    asyncHandler(controller.listProjectMonthlyUserStats.bind(controller))
  );
  router.get(
    '/analytics/summary/employees',
    requirePermission('analytics:read'),
    asyncHandler(controller.listEmployeeSummaryStats.bind(controller))
  );
  router.get(
    '/analytics/summary/projects',
    requirePermission('analytics:read'),
    asyncHandler(controller.listProjectSummaryStats.bind(controller))
  );
  router.get(
    '/analytics/users/:slackUserId/projects',
    requirePermission('analytics:read'),
    asyncHandler(controller.listUserProjectMonthlyStats.bind(controller))
  );
  router.get(
    '/analytics/projects/:projectName/users',
    requirePermission('analytics:read'),
    asyncHandler(controller.listProjectUsersStats.bind(controller))
  );
  return router;
}
