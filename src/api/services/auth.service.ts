import crypto from 'node:crypto';
import { env } from '../../config/env';
import { sha256 } from '../../utils/hash';
import { hashPassword, verifyPassword } from '../../utils/password';
import type { AdminRole } from '../repositories/models';
import type { AdminAuthRepository } from '../repositories/admin-auth.repository';
import { permissionsForRole } from './admin-permissions';

type LoginResult = {
  accessToken: string;
  expiresAt: Date;
  user: {
    id: number;
    email: string;
    role: AdminRole;
    permissions: string[];
  };
};

export class AuthService {
  constructor(private readonly adminAuthRepository: AdminAuthRepository) {}

  async createAdminUser(input: {
    email: string;
    password: string;
    role: AdminRole;
  }): Promise<{
    id: number;
    email: string;
    role: AdminRole;
    active: boolean;
  }> {
    const passwordHash = await hashPassword(input.password);
    const user = await this.adminAuthRepository.createAdminUser({
      email: input.email.trim().toLowerCase(),
      passwordHash,
      role: input.role
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      active: user.active
    };
  }

  async login(email: string, password: string): Promise<LoginResult | null> {
    const user = await this.adminAuthRepository.findAdminUserByEmail(email.trim().toLowerCase());
    if (!user || !user.active) return null;

    const passwordMatches = await verifyPassword(password, user.passwordHash);
    if (!passwordMatches) return null;

    const accessToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = sha256(accessToken);
    const expiresAt = new Date(Date.now() + env.ADMIN_SESSION_TTL_HOURS * 60 * 60 * 1000);
    await this.adminAuthRepository.createSession(user.id, tokenHash, expiresAt);

    return {
      accessToken,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: permissionsForRole(user.role)
      }
    };
  }

  async logout(accessToken: string): Promise<void> {
    await this.adminAuthRepository.revokeSessionByTokenHash(sha256(accessToken));
  }
}
