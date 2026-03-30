# SlackTrack Server

Node.js + Express + TypeScript backend for attendance, reminders, and optional project tracking.

Detailed setup guides:

- Slack app setup: `docs/SLACK_SETUP.md`
- Google Sheets + IAM setup: `docs/GOOGLE_SHEETS_SETUP.md`
- Admin auth + role plan: `docs/ADMIN_AUTH_RBAC_PLAN.md`
- Admin frontend app: `../slacktrack-admin/README.md`

## Local Development (Docker)

1. Copy `.env.example` to `.env` and fill required Slack values.
2. Start services:

```bash
docker compose -f infra/docker/docker-compose.yml up --build
```

This starts:
- API server
- Worker server
- PostgreSQL
- Redis (BullMQ backend)

API docs:
- Swagger UI: `http://localhost:8080/docs`

## End-to-End Project Setup

Follow these steps in order for a clean first run.

1. Configure `.env`
   - Start from `.env.example`
   - Set Slack values (`SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_TEAM_ID`)
   - Set Sheets values (`SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`)
2. Configure Slack app
   - Follow `docs/SLACK_SETUP.md`
3. Configure Google Sheets + IAM
   - Follow `docs/GOOGLE_SHEETS_SETUP.md`
4. Configure admin token
   - Generate token:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

   - Put token in `.env`:

```env
ADMIN_API_KEYS=<generated-token>
```

5. Start services

```bash
docker compose -f infra/docker/docker-compose.yml up --build
```

Set `ADMIN_UI_ORIGIN` in `.env` if your admin frontend runs on a different host/port than `http://localhost:5173`.

6. Seed users

```bash
docker compose -f infra/docker/docker-compose.yml exec api npm run seed:test-users
```

7. Verify health

```bash
curl http://localhost:8080/api/health
```

8. Trigger sheet sync once

```bash
curl -X POST http://localhost:8080/api/admin/sync/reconcile \
  -H "Authorization: Bearer <generated-token>"
```

9. Test reminder delivery
   - Add/confirm a user with `POST /api/admin/users`
   - Create a quick timer with `POST /api/admin/timers` (for example `*/1 * * * *`)
   - Keep API + worker running and verify DM in Slack

## Key API Endpoints

- `POST /api/slack/events`
- `GET /api/health`
- `POST /api/admin/auth/login`
- `POST /api/admin/auth/admin-users`
- `POST /api/admin/auth/logout`
- `GET /api/admin/auth/me`
- `GET /api/admin/projects`
- `POST /api/admin/projects`
- `PATCH /api/admin/projects/:id`
- `GET /api/admin/timers`
- `POST /api/admin/timers`
- `PATCH /api/admin/timers/:id`
- `DELETE /api/admin/timers/:id`
- `POST /api/admin/overrides/attendance`
- `POST /api/admin/overrides/projects`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:slackUserId/messaging/deactivate`
- `POST /api/admin/sync/reconcile`

Admin APIs support login-based sessions and legacy token RBAC:

- Preferred: login via `POST /api/admin/auth/login` (email + password), then use returned `accessToken` as bearer token
- Legacy fallback:
  - `ADMIN_API_KEYS` (full-access tokens)
  - `ADMIN_RBAC_TOKENS_JSON` (permission-scoped tokens)

Role-based model for upcoming admin panel:

- `admin`: full access
- `hr`: almost all operational access (users, timers, sync, overrides)
- `manager`: view-focused (`users:read`, `attendance:read`, `timers:read`, `sync:read`)
- Detailed migration plan: `docs/ADMIN_AUTH_RBAC_PLAN.md`

Create admin/HR/manager accounts (admin only):

- `POST /api/admin/auth/admin-users`
- Body: `{ "email": "manager@company.com", "password": "StrongPassword123", "role": "manager" }`

Seed initial admin user (for login flow):

```bash
ADMIN_SEED_EMAIL=admin@example.com ADMIN_SEED_PASSWORD=StrongPassword123 ADMIN_SEED_ROLE=admin npm run seed:admin-user
```

Swagger authorization:

1. Open `http://localhost:8080/docs`
2. Click **Authorize**
3. Select `bearerAuth` and paste your admin token
4. Call admin endpoints from Swagger UI

Seed test users:

```bash
npm run seed:test-users
```

If you are running with Docker Compose, run seed inside the API container:

```bash
docker compose -f infra/docker/docker-compose.yml exec api npm run seed:test-users
```

Reminder recipient seed mapping:

- Update `src/config/slack-user-notification.seed.ts` with `name`, `email`, `slackId`, and `isMessageEnabled`.
- `isMessageEnabled` defaults to `true` when omitted.
- `npm run seed:test-users` now syncs this seed file into the `users` table, including messaging state.
- Reminder dispatch uses DB users with `isMessageEnabled: true`; if DB has no users, the seed file is used as fallback.

User management APIs:

- List users: `GET /api/admin/users`
  - Requires admin permission: `users:read`
- Add/update user: `POST /api/admin/users`
  - Body: `{ "name": "Rahul Anand", "slackId": "U0A5YQ63CMT", "email": "rahul@example.com", "isMessageEnabled": true }`
  - Requires admin permission: `users:write`
- Deactivate messaging: `PATCH /api/admin/users/:slackUserId/messaging/deactivate`
  - Sets `isMessageEnabled` to `false`
  - Requires admin permission: `users:write`

Project catalog APIs:

- List projects: `GET /api/admin/projects`
  - Requires: `projects:read`
- Create/upsert project: `POST /api/admin/projects`
  - Body: `{ "name": "SlackTrack", "active": true }`
  - Requires: `projects:write`
- Update project: `PATCH /api/admin/projects/:id`
  - Body example: `{ "name": "Internal Tooling", "active": false }`
  - Requires: `projects:write`

Slack project modal options now come from active project catalog entries in DB.
Active project names are cached in Redis with TTL (`PROJECT_CATALOG_CACHE_TTL_SECONDS`) and invalidated on project create/update.

## Standards

- 3-layer architecture: controller -> service -> repository
- BullMQ is isolated behind queue interfaces
- DB is source of truth; sheet/excel is projection layer
