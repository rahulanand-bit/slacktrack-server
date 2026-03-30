import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requirePermission } from '../middlewares/admin-rbac.middleware';
import type { OverrideController } from '../controllers/override.controller';

export function createOverrideRouter(controller: OverrideController): Router {
  const router = Router();
  router.post(
    '/overrides/attendance',
    requirePermission('overrides:write'),
    asyncHandler(controller.overrideAttendance.bind(controller))
  );
  router.post(
    '/overrides/projects',
    requirePermission('overrides:write'),
    asyncHandler(controller.overrideProjects.bind(controller))
  );
  return router;
}
