import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requirePermission } from '../middlewares/admin-rbac.middleware';
import type { SyncController } from '../controllers/sync.controller';

export function createSyncRouter(controller: SyncController): Router {
  const router = Router();
  router.post(
    '/sync/reconcile',
    requirePermission('sync:write'),
    asyncHandler(controller.enqueueManualReconcile.bind(controller))
  );
  return router;
}
