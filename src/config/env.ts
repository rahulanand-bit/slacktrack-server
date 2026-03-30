import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(8080),

  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_DB: z.string().default('slacktrack'),
  POSTGRES_USER: z.string().default('slacktrack'),
  POSTGRES_PASSWORD: z.string().default('slacktrack'),
  DATABASE_URL: z.string().url().optional(),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_TEAM_ID: z.string().optional(),
  TIMEZONE: z.string().default('Asia/Kolkata'),

  ADMIN_API_KEYS: z.string().optional(),
  ADMIN_RBAC_TOKENS_JSON: z.string().optional(),
  ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  ADMIN_UI_ORIGIN: z.string().default('http://localhost:5173'),

  ENABLE_PROJECT_TRACKING: z.coerce.boolean().default(true),
  PROJECT_SPLIT_CHAT_ENABLED: z.coerce.boolean().default(true),
  PROJECT_SPLIT_MODAL_ENABLED: z.coerce.boolean().default(true),
  PROJECT_TRACKING_REQUIRED: z.coerce.boolean().default(false),
  PROJECT_MISSING_REMINDER_ENABLED: z.coerce.boolean().default(true),
  MAX_PROJECTS_PER_DAY: z.coerce.number().int().min(1).max(3).default(3),
  PROJECT_LIST_DELIMITER: z.string().default('|'),
  PROJECT_OPTIONS: z.string().optional(),
  PROJECT_CATALOG_CACHE_TTL_SECONDS: z.coerce.number().int().min(30).max(86400).default(300),

  SPREADSHEET_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),
  SHEET_SYNC_TAB_NAME: z.string().default('Server Sync'),

  GEMINI_API_KEY: z.string().optional()
});

export type Env = z.infer<typeof envSchema>;
export const env: Env = envSchema.parse(process.env);
