import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requirePermission } from '../middlewares/admin-rbac.middleware';
import type { DashboardController } from '../controllers/dashboard.controller';

export function createDashboardRouter(controller: DashboardController): Router {
  const router = Router();
  router.get(
    '/dashboard/summary',
    requirePermission('attendance:read'),
    asyncHandler(controller.getSummary.bind(controller))
  );
  return router;
}
