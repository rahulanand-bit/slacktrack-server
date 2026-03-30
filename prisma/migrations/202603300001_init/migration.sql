CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  slack_user_id TEXT NOT NULL UNIQUE,
  display_name TEXT,
  email TEXT,
  is_message_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_entries (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_ymd DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('WFO', 'WFH', '-1', '-0.5')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date_ymd)
);

CREATE TABLE IF NOT EXISTS project_entries (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_ymd DATE NOT NULL,
  slot_index SMALLINT NOT NULL CHECK (slot_index BETWEEN 1 AND 3),
  project_name TEXT NOT NULL,
  UNIQUE (user_id, date_ymd, slot_index)
);

CREATE TABLE IF NOT EXISTS projects (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS holidays (
  date_ymd DATE PRIMARY KEY,
  holiday_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminder_timers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  timer_type TEXT NOT NULL CHECK (timer_type IN ('morning', 'evening', 'custom')),
  cron_expression TEXT NOT NULL,
  timezone TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manual_override_audit (
  id BIGSERIAL PRIMARY KEY,
  override_type TEXT NOT NULL CHECK (override_type IN ('attendance', 'projects')),
  slack_user_id TEXT NOT NULL,
  date_ymd DATE NOT NULL,
  payload_json JSONB NOT NULL,
  actor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sheet_sync_state (
  sync_key TEXT PRIMARY KEY,
  db_hash TEXT NOT NULL,
  sheet_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'hr', 'manager', 'analytics')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_user_id ON admin_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);
