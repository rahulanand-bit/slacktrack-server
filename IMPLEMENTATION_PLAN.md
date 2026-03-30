# SlackTrack Node.js Server - Implementation Plan

## Goal

Migrate current Google Apps Script features to a Node.js server and add optional project-tracking (single-sheet model), while preserving fast Slack UX (instant ACK + async processing).

---

## 1) Scope

### Current Features to Carry Forward
1. Slack Events API handling (`url_verification`, IM messages).
2. Interactive attendance updates (`WFO`, `WFH`, `Leave (-1)`, `Half Day (-0.5)`).
3. Deduplication for retries/duplicate events.
4. Morning and evening reminders.
5. Skip reminders on weekends and configured holidays.
6. Natural language attendance updates (currently Gemini-based chat parsing).
7. Month sheet preparation and user row pre-warming.
8. Fast row resolution (cache + durable mapping + stale mapping protection).

### New Feature to Add
1. Optional project tracking per user/day in **same sheet**.
2. Support multiple projects per day (max 3 projects).
3. Keep project tracking optional (`PROJECT_TRACKING_REQUIRED=false` default).

---

## 2) Architecture (Target)

### Services
1. **API Service (Node.js)**
   - Receives Slack webhooks/interactivity/commands.
   - Verifies Slack signature.
   - Immediately ACKs Slack (<300ms target).
   - Enqueues async jobs.

2. **Worker Service (Node.js)**
   - Processes queued jobs (attendance update, chat intent, reminders, project update).
   - Calls Google Sheets API and Slack Web API.
   - Handles retries/backoff/idempotency.

3. **Queue**
   - Recommended: BullMQ (Redis) for fast setup OR Pub/Sub/SQS for managed infra.

### Storage
1. Redis (or equivalent) for fast cache + dedupe keys.
2. Durable row map in Redis + optional backup in DB (or Sheet metadata table in same spreadsheet if needed initially).
3. Optional DB (Postgres) for audit/logs (phase 2).

---

## 3) Project Structure (Planned)

```
slactrack-server/
  src/
    app.ts
    config/
    routes/
      slack.routes.ts
    controllers/
      slack.controller.ts
    services/
      slack.service.ts
      attendance.service.ts
      project.service.ts
      reminder.service.ts
      nlp.service.ts
      sheet.service.ts
      rowmap.service.ts
      queue.service.ts
    repositories/
      sheets.repository.ts
      cache.repository.ts
      dedupe.repository.ts
    workers/
      worker.ts
      jobs/
        attendance.job.ts
        project.job.ts
        chat.job.ts
        reminder.job.ts
    utils/
      logger.ts
      time.ts
      validation.ts
  docs/
  tests/
  package.json
  IMPLEMENTATION_PLAN.md
```

---

## 4) API and Slack Flow

### 4.1 Interactive Attendance Click
1. Verify Slack signature.
2. Parse action payload.
3. Return immediate 200 JSON response.
4. Enqueue `attendance.update` job with payload metadata.
5. Worker resolves row, writes attendance + last updated, posts follow-up if needed.
6. Use a single Slack message with two action rows:
   - Row 1: attendance buttons (`WFO`, `WFH`, `Leave (-1)`, `Half Day (-0.5)`).
   - Row 2: `Set Projects (Optional)` (or `Edit Projects`) button.
7. Clicking `Set Projects (Optional)` opens a modal for project selection.
8. Keep project capture optional and independent from attendance success response.
9. If attendance update fails after retries, send a Slack DM to the user with failure reason and retry guidance.
10. Slack button-state UX is limited and best-effort:
   - use message update APIs to reflect status when possible,
   - only supported styles are available (`primary`, `danger`, default),
   - updating previous messages depends on stored message references and bot ownership.

### 4.2 Project Tracking (Optional)
1. In the same attendance message, expose `Set Projects (Optional)` action.
2. Open modal with up to `MAX_PROJECTS_PER_DAY` project inputs.
3. Modal submit ACK immediately and enqueue `project.update` job.
4. Worker validates and writes project entries in the same sheet/day block.
5. Modal supports both create and update mode (pre-fill existing project entries when editing).
6. Do not rely on in-message dropdown submit; use modal submit as the authoritative save action.

### 4.3 Chat Events
1. Events API callback ACK immediately.
2. Enqueue `chat.parse_and_update`.
3. Worker uses NLP to classify both attendance and project intents.
4. Supported project-chat intents:
   - "Projects today: Hoichoi, Happik"
   - "Set my projects for today as Alpha, Beta, Gamma"
   - "Update my projects for today"
5. If chat intent is ambiguous for projects, worker sends a clarification DM.
6. If project tracking is disabled, project-chat intents return a clear "feature disabled" response.

### 4.4 Reminders
1. Scheduled worker jobs for morning/evening.
2. Skip if weekend/holiday.
3. Evening reminder only if no attendance marked.

---

## 5) One-Sheet Data Model (for New Project Feature)

### Existing
- Monthly sheet with day columns and attendance status per user/day.

### Planned (single-sheet, 2-row user block)
For each user, maintain a fixed 2-row block:
1. Row A: attendance status per day (`WFO/WFH/-1/-0.5`)
2. Row B: projects for the day (up to 3 names, stored as delimited list)

### Notes
- Keep max project slots configurable (`MAX_PROJECTS_PER_DAY`, default 3).
- Optional mode: if no project entered, attendance-only remains valid.
- Validation rule: allow 0-3 project names only; reject more than 3.
- Store projects in a deterministic delimiter format (for example `ProjectA | ProjectB | ProjectC`) for easy parse and sync.
- Add a clear visual separator (border/background band) after each 2-row user block for readability.
- Scrolling behavior requirement: do not freeze header row or identity columns; headers, `UserName`, and `SlackID` should move naturally while scrolling.
- Weekend formatting rule: weekend day columns must be highlighted in light pink/red across the entire column.
- Weekend header cells must use a darker shade than weekend body cells for clear visual hierarchy.
- Project color rule: each distinct project should have a visibly distinct color so project entries are easy to differentiate at a glance.
- Maintain a stable project-to-color mapping (same project keeps same color across days/users unless remapped intentionally).

---

## 6) Config and Feature Flags

1. `ENABLE_PROJECT_TRACKING=true|false`
2. `PROJECT_TRACKING_REQUIRED=false|true`
3. `MAX_PROJECTS_PER_DAY=3`
4. `HOLIDAY_YMD=comma-separated list`
5. `TIMEZONE`
6. `SLACK_TEAM_ID`, `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`
7. `SPREADSHEET_ID`
8. `GEMINI_API_KEY`
9. Queue/cache configs (`REDIS_URL`, etc.)
10. `PROJECT_SPLIT_CHAT_ENABLED=true|false`
11. `PROJECT_SPLIT_MODAL_ENABLED=true|false`
12. `PROJECT_LIST_DELIMITER="|"`

---

## 7) Data Authority and Manual Sheet Edit Policy

### Policy
1. Backend DB is the single source of truth for attendance and project tracking data.
2. Excel/Google Sheet is an analytics/projection surface generated from server-approved data.
3. Sheet data is considered valid only when it is synced from successful server writes.

### Manual Edit Handling
1. Protect operational ranges in Google Sheets to prevent direct edits by default.
2. If manual corrections are needed, route them through controlled APIs:
   - `POST /overrides/attendance`
   - `POST /overrides/projects`
   - (Exact endpoint naming can be finalized during implementation.)
3. Override API flow:
   - caller is authenticated/authorized,
   - server validates payload and writes to DB first,
   - sync worker updates sheet from DB.
4. Direct sheet edits outside override APIs are treated as drift and not authoritative.

### Event and Drift Strategy
1. Google Sheets does not provide reliable native cell-level webhooks to Node.
2. Optional event bridge: bound Apps Script `onEdit` posts edit metadata to server (best-effort).
3. Mandatory reconciliation job (every 5-15 min):
   - compare sheet values vs DB snapshot/version,
   - alert on mismatches,
   - auto-repair by overwriting sheet from DB where policy allows.
4. Add metadata/version columns (or hidden sync sheet) to support conflict detection and audit.
5. Drift resolution rule: DB wins. Sheet is re-synced to match DB after drift is detected.

### Success Criteria for This Policy
1. No critical business state exists only in sheet cells.
2. Manual sheet edits cannot silently corrupt backend truth.
3. Reconciliation can detect and repair drift deterministically.
4. Manual/override corrections are accepted only through server APIs and are fully auditable.

---

## 8) Core Implementation Tasks

### Phase 1 - Foundation
1. Bootstrap Node service (Express/Fastify + TypeScript).
2. Add Slack signature verification middleware.
3. Add structured logging and error handling.
4. Integrate queue and worker runtime.
5. Add health/readiness endpoints.

### Phase 2 - Attendance Migration
1. Implement row map service (month-scoped, cache-first, stale-check).
2. Implement fast attendance write worker.
3. Implement dedupe keys and idempotency.
4. Implement sheet month resolver/pre-create logic.
5. Add failure notification workflow: on terminal update failure, send user DM and record failure metrics.

### Phase 3 - Reminders + Holidays
1. Morning/evening reminder jobs.
2. Weekend + holiday skip logic.
3. Attendance check before evening reminder.

### Phase 4 - Chat/NLP
1. Chat event ingestion + queue job.
2. Gemini parser integration.
3. Multi-date attendance update support and response messaging.
4. Add project-tracking chat intent schema and validation pipeline.
5. Add clarification prompts for incomplete project inputs.

### Phase 5 - Project Tracking (New)
1. Add optional project modal flow launched from `Set Projects (Optional)` button in attendance message.
2. Add validation (0-3 projects/day, optional enforcement).
3. Write project data into same-sheet 2-row block.
4. Add optional reminder to fill projects if attendance exists but projects are missing.
5. Add modal edit flow for same-day project updates.
6. Implement best-effort status styling/text updates in Slack messages, with fallback to DM/status text where not supported.
7. Apply sheet formatting rules for user block separation and non-frozen scrolling behavior.
8. Apply weekend column color styling (darker weekend header, lighter weekend body cells).
9. Implement project color rendering with stable mapping and readable contrast.

### Phase 6 - Hardening
1. Retry/backoff/dead-letter policies.
2. Metrics and tracing dashboards.
3. Integration and load tests.
4. Rollout with feature flags and fallback controls.

---

## 9) Testing Strategy

1. Unit tests
   - action parsing, dedupe, date/day mapping, holiday/weekend skip.
2. Integration tests
   - Slack webhook -> queue -> worker -> Sheets write.
3. E2E tests
   - button click success path, duplicate click, stale row mapping recovery.
   - terminal update failure sends Slack DM to requester.
4. New feature tests
   - multi-project list validation (max 3), optional mode, required mode.
   - one-message UX with attendance row + project button row.
   - modal create/edit flow for project tracking.
   - chat project-intent parsing and clarification prompts.
   - weekend column style verification (header darker than body cells).
   - project color mapping verification (distinct colors and stable mapping consistency).
5. Performance tests
   - P95 ACK time target < 300ms.
   - Worker completion target (attendance) < 2s typical.

---

## 10) Rollout Plan

1. Deploy Node service in shadow mode (read-only or no-op writes initially).
2. Compare outputs against Apps Script for a pilot user set.
3. Enable attendance writes from Node behind feature flag.
4. Enable reminders and chat processing from Node.
5. Enable project tracking for pilot users.
6. Decommission Apps Script interactive endpoint after stable run.

---

## 11) Risks and Mitigations

1. Sheet schema complexity with 2-row blocks
   - Mitigation: strict helper functions + schema validator + migration script.
2. Duplicate events from Slack retries
   - Mitigation: idempotency keys in Redis + job dedupe.
3. Queue outages
   - Mitigation: dead-letter queue + alerting + replay tools.
4. Feature creep in first release
   - Mitigation: phase-based rollout and feature flags.
5. Slack UI constraints for historical button color/state changes
   - Mitigation: treat visual button state as best-effort; rely on status text and DM confirmations as authoritative user feedback.

---

## 12) Definition of Done

1. Slack interactive requests always ACK quickly (<300ms target).
2. Attendance updates succeed via async worker with retry safety.
3. Failed attendance updates always trigger a Slack DM to the requester.
4. Weekend/holiday reminders are skipped correctly.
5. Chat updates work with queued NLP handling.
6. Project tracking works in same sheet, supports up to 3 projects/day, and is optional.
7. Logs/metrics/alerts are in place for production support.

---

## 13) Admin Auth and Role-Based Access (New)

1. Add login/logout APIs for admin users (`email + password`).
2. Add authenticated profile API (`/auth/me`) for admin panel session hydration.
3. Implement role-based permissions:
   - `hr`: users management + attendance overrides
   - `manager`: mostly read access + limited override capability
4. Keep current token-based RBAC temporarily for migration safety.
5. Audit all admin actions with actor identity and role.

---

## Plan Change Log

- v0.1: Initial migration + project-tracking plan drafted.
- v0.2: Added explicit button/modal and chat intent requirements for project tracking, plus feature flags for modal/chat control.
- v0.3: Added data authority policy (DB as source of truth), manual edit handling, and sheet drift reconciliation strategy.
- v0.4: Added mandatory Slack DM notification policy for terminal attendance update failures.
- v0.5: Updated project model to 2-row per user design (status row + project list row, max 3 projects/day, no percentage split).
- v0.6: Finalized interaction UX as one Slack message with attendance buttons plus `Set Projects (Optional)` button that opens modal.
- v0.7: Explicitly finalized DB as source of truth, added manual/override API policy, and defined drift reconciliation with DB-wins rule.
- v0.8: Added limited, best-effort Slack button state update strategy for success/failure visualization.
- v0.9: Added sheet UX requirement for 2-row user block visual separation and non-frozen scrolling behavior.
- v1.0: Added weekend color-format requirement (entire weekend column highlighted; header darker than body).
- v1.1: Added project color-coding requirement (distinct per-project colors with stable mapping).
- v1.2: Added admin auth upgrade scope (login/logout + HR/Manager role-based access model).
- (Update this section as implementation decisions change.)
