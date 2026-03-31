import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requirePermission } from '../middlewares/admin-rbac.middleware';
import type { HolidayController } from '../controllers/holiday.controller';

export function createHolidayRouter(controller: HolidayController): Router {
  const router = Router();
  router.get('/holidays', requirePermission('holidays:read'), asyncHandler(controller.listHolidays.bind(controller)));
  router.put(
    '/holidays',
    requirePermission('holidays:write'),
    asyncHandler(controller.replaceHolidays.bind(controller))
  );
  return router;
}
