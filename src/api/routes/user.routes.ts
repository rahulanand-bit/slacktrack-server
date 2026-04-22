import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requirePermission } from '../middlewares/admin-rbac.middleware';
import type { UserAdminController } from '../controllers/user-admin.controller';

export function createUserRouter(controller: UserAdminController): Router {
  const router = Router();

  router.get('/users', requirePermission('users:read'), asyncHandler(controller.listUsers.bind(controller)));
  router.post('/users', requirePermission('users:write'), asyncHandler(controller.createUser.bind(controller)));
  router.post('/users/bulk', requirePermission('users:write'), asyncHandler(controller.createUsersBulk.bind(controller)));
  router.patch('/users/:slackUserId', requirePermission('users:write'), asyncHandler(controller.updateUser.bind(controller)));
  router.patch(
    '/users/:slackUserId/messaging',
    requirePermission('users:write'),
    asyncHandler(controller.setMessagingEnabled.bind(controller))
  );
  router.patch(
    '/users/:slackUserId/messaging/deactivate',
    requirePermission('users:write'),
    asyncHandler(controller.deactivateMessaging.bind(controller))
  );
  router.patch(
    '/users/:slackUserId/archive',
    requirePermission('users:write'),
    asyncHandler(controller.archiveUser.bind(controller))
  );
  router.patch(
    '/users/:slackUserId/restore',
    requirePermission('users:write'),
    asyncHandler(controller.restoreUser.bind(controller))
  );

  return router;
}
