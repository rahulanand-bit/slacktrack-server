import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

export const cacheRedis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 1
});

cacheRedis.on('error', (error: Error) => {
  logger.warn({ error: error.message }, 'Redis cache connection issue');
});
