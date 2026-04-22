import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requirePermission } from '../middlewares/admin-rbac.middleware';
import type { AnalyticsController } from '../controllers/analytics.controller';

export function createAnalyticsRouter(controller: AnalyticsController): Router {
  const router = Router();
  router.get('/analytics/charts', requirePermission('analytics:read'), asyncHandler(controller.getCharts.bind(controller)));
  router.get('/analytics/overview', requirePermission('analytics:read'), asyncHandler(controller.getOverview.bind(controller)));
  router.get('/analytics/trend', requirePermission('analytics:read'), asyncHandler(controller.getTrend.bind(controller)));
  router.get(
    '/analytics/hr/insights',
    requirePermission('analytics:read'),
    asyncHandler(controller.getHrInsights.bind(controller))
  );
  router.get(
    '/analytics/finance/project-contribution',
    requirePermission('analytics:read'),
    asyncHandler(controller.getFinanceProjectContribution.bind(controller))
  );
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
  router.get(
    '/analytics/status-breakdown',
    requirePermission('analytics:read'),
    asyncHandler(controller.listStatusBreakdown.bind(controller))
  );
  return router;
}
