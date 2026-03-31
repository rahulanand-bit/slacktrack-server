import type { AdminRole } from '../repositories/models';

const ROLE_PERMISSION_MAP: Record<AdminRole, string[]> = {
  admin: ['*'],
  hr: [
    'users:read',
    'users:write',
    'projects:read',
    'projects:write',
    'attendance:read',
    'attendance:write',
    'overrides:write',
    'timers:read',
    'timers:write',
    'holidays:read',
    'holidays:write',
    'sync:read',
    'sync:write',
    'audit:read'
  ],
  manager: ['users:read', 'projects:read', 'attendance:read', 'timers:read', 'holidays:read', 'sync:read'],
  analytics: ['users:read', 'attendance:read']
};

export function permissionsForRole(role: AdminRole): string[] {
  return ROLE_PERMISSION_MAP[role] || [];
}
