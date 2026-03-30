import { dbPool } from '../../config/db';
import type { AdminRole, AdminUserRecord } from './models';

type SessionPrincipal = {
  userId: number;
  email: string;
  role: AdminRole;
  sessionId: number;
};

function mapAdminUserRow(row: {
  id: number;
  email: string;
  password_hash: string;
  role: AdminRole;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}): AdminUserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class AdminAuthRepository {
  async findAdminUserByEmail(email: string): Promise<AdminUserRecord | null> {
    const result = await dbPool.query(
      `
      SELECT id, email, password_hash, role, active, created_at, updated_at
      FROM admin_users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [email]
    );

    if (result.rowCount === 0) return null;
    return mapAdminUserRow(result.rows[0]);
  }

  async findAdminUserById(id: number): Promise<AdminUserRecord | null> {
    const result = await dbPool.query(
      `
      SELECT id, email, password_hash, role, active, created_at, updated_at
      FROM admin_users
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (result.rowCount === 0) return null;
    return mapAdminUserRow(result.rows[0]);
  }

  async createSession(adminUserId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    await dbPool.query(
      `
      INSERT INTO admin_sessions (admin_user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
      `,
      [adminUserId, tokenHash, expiresAt]
    );
  }

  async findSessionPrincipalByTokenHash(tokenHash: string): Promise<SessionPrincipal | null> {
    const result = await dbPool.query(
      `
      SELECT
        s.id AS session_id,
        u.id AS user_id,
        u.email,
        u.role
      FROM admin_sessions s
      INNER JOIN admin_users u ON u.id = s.admin_user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
        AND u.active = TRUE
      LIMIT 1
      `,
      [tokenHash]
    );

    if (result.rowCount === 0) return null;
    const row = result.rows[0] as {
      session_id: number;
      user_id: number;
      email: string;
      role: AdminRole;
    };

    return {
      userId: row.user_id,
      email: row.email,
      role: row.role,
      sessionId: row.session_id
    };
  }

  async revokeSessionByTokenHash(tokenHash: string): Promise<void> {
    await dbPool.query(
      `
      UPDATE admin_sessions
      SET revoked_at = NOW()
      WHERE token_hash = $1
        AND revoked_at IS NULL
      `,
      [tokenHash]
    );
  }

  async createAdminUser(input: {
    email: string;
    passwordHash: string;
    role: AdminRole;
  }): Promise<AdminUserRecord> {
    const result = await dbPool.query(
      `
      INSERT INTO admin_users (email, password_hash, role)
      VALUES (LOWER($1), $2, $3)
      ON CONFLICT (email)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        active = TRUE,
        updated_at = NOW()
      RETURNING id, email, password_hash, role, active, created_at, updated_at
      `,
      [input.email, input.passwordHash, input.role]
    );

    return mapAdminUserRow(result.rows[0]);
  }
}
