import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import type { SlackController } from '../controllers/slack.controller';

export function createSlackRouter(controller: SlackController): Router {
  const router = Router();
  router.post('/slack/events', asyncHandler(controller.postSlack.bind(controller)));
  return router;
}
