# AGENTS.md

## Purpose

This document defines implementation standards for the SlackTrack Node.js server.
All new server setup and implementation work must be done inside `slacktrack-server/`.

---

## Stack (Locked)

- Runtime: Node.js
- Framework: Express
- Language: TypeScript (strict mode)
- Database: PostgreSQL
- Queue: BullMQ
- Cache/Queue backend: Redis

---

## Architecture Rules (Mandatory)

Use a 3-layer architecture everywhere:

1. Controller layer
   - HTTP/webhook entrypoints only
   - Request parsing, auth/signature checks, response mapping
   - No business logic and no direct DB calls

2. Service layer
   - Business rules and orchestration
   - Validation and workflow decisions
   - Calls repositories and external adapters

3. Repository layer
   - Data access only
   - DB queries and persistence abstractions
   - No business logic

Dependency direction must remain:
`controller -> service -> repository`

---

## Queue Architecture Rules (Mandatory)

Use BullMQ with strict modular separation between APIs and queue internals.

1. API modules must not directly create or manage BullMQ queue/worker instances.
2. Controllers and services should depend on queue interfaces (for example `JobPublisher`), not BullMQ classes.
3. Queue adapter layer is responsible for BullMQ-specific implementation details.
4. Worker processes must be isolated from API runtime and consume jobs independently.
5. Shared job contracts (payload schema, queue names, retry policy) must be versioned and typed.

Dependency boundary:
`controller -> service -> queue interface` and `bullmq adapter -> queue interface`

---

## Database Decision

Use **PostgreSQL** as the primary database.

Reasoning:
- Attendance/project records are relational and auditable.
- We need reliable constraints, transactions, and deterministic reconciliation.
- Better fit than MongoDB for structured reporting and override history.

---

## Infrastructure (Mandatory)

Run local/dev infrastructure with Docker.

Minimum expected Docker services:
1. `api` (Express server)
2. `worker` (async job processor)
3. `postgres` (primary DB)
4. `redis` (BullMQ backend + cache + dedupe)

Required artifacts:
- `Dockerfile` (API/worker runtime image)
- `docker-compose.yml` (or compose equivalent)
- `.env.example` with required variables

All services should be runnable with one command (for example `docker compose up`).

---

## Testing Requirements (Mandatory)

Implement tests from day one:

1. Unit tests
   - Service-level business rules
   - Validation logic

2. Integration tests
   - Controller + service + repository flow
   - Slack webhook to persisted outcome

3. E2E/smoke tests
   - Critical user flows (attendance update, failure notification, reminder rules)

4. Contract tests (recommended)
   - Slack payload parsing and response contract stability

No feature is complete without tests for happy path and failure path.

---

## Linting and Code Quality

Set up and enforce:

- ESLint (TypeScript rules)
- Prettier
- TypeScript strict checks (`noImplicitAny`, strict null checks)
- Pre-commit hooks for lint + test (recommended)
- Structured logger: use **Pino**

CI must fail on lint or test failures.

---

## Suggested Initial Structure

```
slacktrack-server/
  src/
    api/
      controllers/
      services/
      repositories/
      routes/
    queues/
      contracts/
      publishers/
      consumers/
    config/
    utils/
  tests/
    unit/
    integration/
    e2e/
  infra/
    docker/
      Dockerfile
      docker-compose.yml
  package.json
  tsconfig.json
  .eslintrc.*
  .prettierrc
  .env.example
```

---

## Operational Notes

- DB is source of truth; sheet/excel is a synced projection layer.
- Manual corrections must be API-driven and auditable.
- Keep chat ACK fast; async processing should happen via queue/worker.
- BullMQ must remain an infrastructure concern behind interfaces; avoid leaking BullMQ types into controllers/services.
- If backend API contracts, routes, request/response shapes, or auth behavior change, update Swagger spec in the same change set.

---

## Product Guardrails (from implementation plan)

1. Slack interaction UX
   - One message with two action rows:
     - Row 1: attendance buttons (`WFO`, `WFH`, `Leave (-1)`, `Half Day (-0.5)`)
     - Row 2: `Set Projects (Optional)` / `Edit Projects`
   - Project entry is modal-based and optional.

2. Project data model
   - Per user: fixed 2-row sheet block
     - Row A: attendance status per day
     - Row B: projects list per day (max 3)
   - Use deterministic delimiter for project list.

3. Reliability and notifications
   - Immediate chat ACK, async processing for updates.
   - Send failure DM on terminal attendance update failure.
   - Skip reminders on weekends and configured holidays.

4. Data authority
   - DB always wins during drift reconciliation.
   - Direct sheet edits are non-authoritative and must be reconciled.
   - Manual overrides must go through secured APIs.
