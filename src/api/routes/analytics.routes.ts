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
    '/analytics/users/:slackUserId/projects',
    requirePermission('analytics:read'),
    asyncHandler(controller.listUserProjectMonthlyStats.bind(controller))
  );
  return router;
}
