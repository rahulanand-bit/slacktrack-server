# Admin Auth + RBAC Upgrade Plan

## Goal

Move admin access from static API-key usage to login-based authentication (`email + password`) with role-based permissions for Admin, HR, Manager, and Analytics roles.

## Current State

- Admin APIs are protected by bearer tokens via:
  - `ADMIN_API_KEYS` (full access)
  - `ADMIN_RBAC_TOKENS_JSON` (permission arrays)

## Target State

1. Login/logout endpoints for admin users
2. Session or JWT-based authentication
3. Role-based permission mapping
4. Backward-compatible token mode during migration window

## Roles and Permissions

### `hr`
- `users:read`
- `users:write`
- `attendance:read`
- `attendance:write`
- `overrides:write`
- `sync:write`
- `timers:read`
- `timers:write`
- `audit:read`

### `manager`
- `users:read`
- `attendance:read`
- `overrides:write` (limited scope; team-managed users)
- `timers:read`
- `sync:read`

### `analytics`
- `users:read`
- `attendance:read`

## Proposed API Contracts

1. `POST /api/admin/auth/login`
   - body: `{ "email": "...", "password": "..." }`
   - returns access token + user profile
2. `POST /api/admin/auth/logout`
   - invalidates current session/token (or marks refresh token revoked)
3. `GET /api/admin/auth/me`
   - returns authenticated admin profile + role + effective permissions

## Data Model Additions

### `admin_users`
- `id`
- `email` (unique)
- `password_hash`
- `role` (`admin` | `hr` | `manager` | `analytics`)
- `active`
- `created_at`, `updated_at`

### `admin_sessions` (if stateful session/refresh token)
- `id`
- `admin_user_id`
- `token_hash`
- `expires_at`
- `revoked_at`
- `created_at`

## Middleware Changes

1. Extend admin auth middleware to support:
   - login-issued token verification
   - role and permission attachment to `req.adminAuth`
2. Keep legacy API-key mode enabled behind feature flag for migration.

## Express Request Context (target)

```ts
req.adminAuth = {
  actorId: 'admin-user-id',
  role: 'hr',
  permissions: ['users:read', 'users:write']
}
```

## Security Requirements

1. Password hashing with bcrypt/argon2
2. Short-lived access token
3. Refresh token rotation/revocation (if JWT refresh model)
4. Rate limiting on login endpoint
5. Audit login success/failure and sensitive admin actions

## Migration Plan

1. Add auth tables and seed one `superadmin` account.
2. Add login/logout/me APIs.
3. Update middleware for dual-mode auth (login token + old API keys).
4. Update Swagger and README with auth flow.
5. Move admin panel to login flow.
6. Deprecate static API keys after rollout validation.
