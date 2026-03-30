import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import {
  requireAuthenticatedAdmin,
  requirePermission
} from '../middlewares/admin-rbac.middleware';
import type { AuthController } from '../controllers/auth.controller';

export function createAuthRouter(controller: AuthController): Router {
  const router = Router();

  router.post('/auth/login', asyncHandler(controller.login.bind(controller)));
  router.post(
    '/auth/admin-users',
    requirePermission('admin:write'),
    asyncHandler(controller.createAdminUser.bind(controller))
  );
  router.post('/auth/logout', requireAuthenticatedAdmin(), asyncHandler(controller.logout.bind(controller)));
  router.get('/auth/me', requireAuthenticatedAdmin(), asyncHandler(controller.me.bind(controller)));

  return router;
}
