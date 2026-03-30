import { createWorkers } from '../queues/consumers/worker-factory';
import { logger } from '../config/logger';
import { container } from '../container';
import { JOB_NAMES } from '../config/constants';
import { queueRegistry } from '../queues/publishers/bullmq-job-publisher';

async function bootstrapWorkers() {
  await container.services.timerService.syncSchedulesOnStartup();
  createWorkers();
  await queueRegistry.syncQueue.add(
    JOB_NAMES.SHEET_RECONCILE,
    { reason: 'periodic' },
    {
      jobId: 'sync:periodic',
      repeat: { pattern: '*/10 * * * *' },
      removeOnComplete: 100,
      removeOnFail: 500
    }
  );
  logger.info('Workers started');
}

void bootstrapWorkers();
