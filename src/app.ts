import express, { type NextFunction, type Request, type Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { logger } from './config/logger';
import { createHealthRouter } from './api/routes/health.routes';
import { createOverrideRouter } from './api/routes/override.routes';
import { createProjectRouter } from './api/routes/project.routes';
import { createAuthRouter } from './api/routes/auth.routes';
import { createSlackRouter } from './api/routes/slack.routes';
import { createSyncRouter } from './api/routes/sync.routes';
import { createTimerRouter } from './api/routes/timer.routes';
import { createUserRouter } from './api/routes/user.routes';
import { buildSwaggerSpec } from './config/swagger';
import { container } from './container';

type RawBodyRequest = Request & { rawBody?: string };

export function createApp() {
  const app = express();

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', env.ADMIN_UI_ORIGIN);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  const rawBodySaver = (req: Request, _res: Response, buf: Buffer) => {
    (req as RawBodyRequest).rawBody = buf.toString('utf8');
  };

  app.use(express.json({ verify: rawBodySaver }));
  app.use(express.urlencoded({ extended: true, verify: rawBodySaver }));

  const swaggerSpec = buildSwaggerSpec();
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use('/api', createHealthRouter());
  app.use('/api', createSlackRouter(container.controllers.slackController));
  app.use('/api/admin', createAuthRouter(container.controllers.authController));
  app.use('/api/admin', createProjectRouter(container.controllers.projectCatalogController));
  app.use('/api/admin', createTimerRouter(container.controllers.timerController));
  app.use('/api/admin', createUserRouter(container.controllers.userAdminController));
  app.use('/api/admin', createOverrideRouter(container.controllers.overrideController));
  app.use('/api/admin', createSyncRouter(container.controllers.syncController));

  app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    void next;
    logger.error({ error: err.message }, 'Unhandled request error');
    res.status(500).json({ ok: false, error: err.message });
  });

  return app;
}
