import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';

export function createHealthRouter(): Router {
  const router = Router();
  const controller = new HealthController();
  router.get('/health', controller.getHealth.bind(controller));
  return router;
}
