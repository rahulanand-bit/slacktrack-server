import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { container } from './container';

async function bootstrap() {
  await container.services.timerService.syncSchedulesOnStartup();

  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'API server started');
  });
}

void bootstrap();
