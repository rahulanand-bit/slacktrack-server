import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { sha256 } from '../../utils/hash';
import { AdminAuthRepository } from '../repositories/admin-auth.repository';
import { permissionsForRole } from '../services/admin-permissions';

type TokenPermissionMap = Record<string, string[]>;

const adminAuthRepository = new AdminAuthRepository();

function buildTokenPermissionMap(): TokenPermissionMap {
  const map: TokenPermissionMap = {};

  const adminKeys = (env.ADMIN_API_KEYS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  for (const token of adminKeys) {
    map[token] = ['*'];
  }

  const rawRbac = env.ADMIN_RBAC_TOKENS_JSON;
  if (!rawRbac) return map;

  try {
    const parsed = JSON.parse(rawRbac) as Record<string, unknown>;
    for (const [token, permissions] of Object.entries(parsed)) {
      if (!Array.isArray(permissions)) continue;
      map[token] = permissions.map((permission) => String(permission));
    }
  } catch {
    // invalid RBAC JSON should not crash app startup
  }

  return map;
}

const tokenPermissionMap = buildTokenPermissionMap();

function extractBearerToken(req: Request): string | null {
  const header = req.header('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return match[1]?.trim() || null;
}

async function authenticateAdmin(req: Request): Promise<boolean> {
  const token = extractBearerToken(req);
  if (!token) return false;

  const legacyPermissions = tokenPermissionMap[token];
  if (legacyPermissions) {
    req.adminAuth = {
      actorId: token.slice(0, 8),
      email: null,
      role: 'admin',
      permissions: legacyPermissions,
      token
    };
    return true;
  }

  const principal = await adminAuthRepository.findSessionPrincipalByTokenHash(sha256(token));
  if (!principal) return false;

  req.adminAuth = {
    actorId: String(principal.userId),
    email: principal.email,
    role: principal.role,
    permissions: permissionsForRole(principal.role),
    token
  };

  return true;
}

export function requireAuthenticatedAdmin() {
  return (req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      const authenticated = await authenticateAdmin(req);
      if (!authenticated) {
        res.status(401).json({ ok: false, error: 'Missing or invalid admin token' });
        return;
      }

      next();
    })().catch((error: Error) => {
      res.status(500).json({ ok: false, error: error.message });
    });
  };
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void (async () => {
      const authenticated = await authenticateAdmin(req);
      if (!authenticated || !req.adminAuth) {
        res.status(401).json({ ok: false, error: 'Missing or invalid admin token' });
        return;
      }

      const allowed =
        req.adminAuth.permissions.includes('*') || req.adminAuth.permissions.includes(permission);
      if (!allowed) {
        res.status(403).json({ ok: false, error: `Permission denied for ${permission}` });
        return;
      }

      next();
    })().catch((error: Error) => {
      res.status(500).json({ ok: false, error: error.message });
    });
  };
}
