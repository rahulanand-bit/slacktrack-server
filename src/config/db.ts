import { Pool } from 'pg';
import { env } from './env';

const connectionString =
  env.DATABASE_URL ||
  `postgres://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`;

export const dbPool = new Pool({
  connectionString,
  max: 20
});
