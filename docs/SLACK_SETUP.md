# Slack App Setup

This guide covers how to create and configure a Slack app for SlackTrack Server.

## 1) Create Slack app

1. Open `https://api.slack.com/apps`.
2. Click **Create New App** -> **From scratch**.
3. Enter app name (for example `SlackTrack Dev`) and select your workspace.

## 2) Configure bot scopes

Go to **OAuth & Permissions** -> **Bot Token Scopes**, add:

- `chat:write`
- `chat:write.public` (optional, helpful for channel posting)
- `im:read`
- `im:write`
- `users:read` (optional)

Then click **Install to Workspace** (or **Reinstall to Workspace** after changes).

Copy the bot token (`xoxb-...`) and set in `.env`:

```env
SLACK_BOT_TOKEN=xoxb-...
```

## 3) Get signing secret

1. Go to **Basic Information** -> **App Credentials**.
2. Copy **Signing Secret**.

Set in `.env`:

```env
SLACK_SIGNING_SECRET=...
```

## 4) Set team ID

From Slack web URL or app details, copy workspace/team ID (looks like `T...`) and set:

```env
SLACK_TEAM_ID=T670G9SQ6
```

## 5) Configure request URLs

This project uses a single endpoint for events and interactive payloads:

- `POST /api/slack/events`

For local development, expose your local server publicly with ngrok (or similar):

```bash
ngrok http 8080
```

Use the HTTPS ngrok URL below as base URL in Slack config.

### Event Subscriptions

1. Go to **Event Subscriptions**.
2. Enable events.
3. Request URL: `https://<your-ngrok-domain>/api/slack/events`
4. Subscribe to bot events:
   - `message.im`

### Interactivity

1. Go to **Interactivity & Shortcuts**.
2. Turn **Interactivity** ON.
3. Request URL: `https://<your-ngrok-domain>/api/slack/events`

## 6) Run and verify

1. Start project services (see `README.md`).
2. In Slack, DM the bot with attendance text (for example `wfh`) and verify API/worker logs.
3. Use admin APIs to add users and enable reminders.

## 7) Common issues

- `Invalid Slack signature`: wrong `SLACK_SIGNING_SECRET` or stale tunnel URL.
- Bot cannot DM: app not installed or missing `im:*`/`chat:write` scopes.
- Wrong workspace events ignored: verify `SLACK_TEAM_ID`.
