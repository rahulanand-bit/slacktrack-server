# Google Sheets + IAM Setup

This guide covers Google Sheets integration for projection sync.

## 1) Create one spreadsheet

1. Open Google Sheets and create a new spreadsheet.
2. Name it (for example `SlackTrack sheet`).
3. Copy Spreadsheet ID from URL:

`https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`

Set in `.env`:

```env
SPREADSHEET_ID=<SPREADSHEET_ID>
```

You only need one spreadsheet. The app creates month tabs (`March 2026`, `April 2026`, etc.) automatically during reconcile.

## 2) Create Google Cloud project + enable API

1. Open `https://console.cloud.google.com/`.
2. Create/select a project.
3. Go to **APIs & Services** -> **Library**.
4. Enable **Google Sheets API**.

## 3) Create service account and key

1. Go to **IAM & Admin** -> **Service Accounts**.
2. Click **Create Service Account**.
3. Open created account -> **Keys** tab.
4. **Add Key** -> **Create new key** -> JSON.
5. Download JSON file.

From JSON:

- `client_email` -> `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key` -> `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

Set in `.env`:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

Important: keep private key in one line with `\n` escaped line breaks.

## 4) Share spreadsheet with service account

1. Open your spreadsheet.
2. Click **Share**.
3. Add `GOOGLE_SERVICE_ACCOUNT_EMAIL`.
4. Set role to **Editor**.
5. Save/Send.

Without Editor access, sync/write will fail.

## 5) Trigger first sync (creates tabs)

Start API + worker, then trigger manual reconcile:

```bash
curl -X POST http://localhost:8080/api/admin/sync/reconcile \
  -H "Authorization: Bearer <admin-token>"
```

This will:

- check/create monthly tabs
- write user + attendance projection
- apply formatting

## 6) Common issues

- `Skipping sheet write because Google Sheets credentials are not configured`:
  missing one of `SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, or `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`.
- `The caller does not have permission`:
  spreadsheet not shared with service account as Editor.
- No data visible:
  ensure users are seeded/created and trigger reconcile again.
