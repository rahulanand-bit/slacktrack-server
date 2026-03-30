import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requirePermission } from '../middlewares/admin-rbac.middleware';
import type { TimerController } from '../controllers/timer.controller';

export function createTimerRouter(controller: TimerController): Router {
  const router = Router();
  router.get('/timers', requirePermission('timers:read'), asyncHandler(controller.listTimers.bind(controller)));
  router.post(
    '/timers',
    requirePermission('timers:write'),
    asyncHandler(controller.createTimer.bind(controller))
  );
  router.patch(
    '/timers/:id',
    requirePermission('timers:write'),
    asyncHandler(controller.updateTimer.bind(controller))
  );
  router.delete(
    '/timers/:id',
    requirePermission('timers:write'),
    asyncHandler(controller.deleteTimer.bind(controller))
  );
  router.post(
    '/timers/trigger-attendance',
    requirePermission('timers:write'),
    asyncHandler(controller.triggerAttendanceReminder.bind(controller))
  );
  return router;
}
