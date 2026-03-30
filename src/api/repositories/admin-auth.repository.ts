import { prisma } from '../../config/prisma';
import type { AdminRole, AdminUserRecord } from './models';

type SessionPrincipal = {
  userId: number;
  email: string;
  role: AdminRole;
  sessionId: number;
};

function mapAdminUser(row: {
  id: bigint;
  email: string;
  passwordHash: string;
  role: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AdminUserRecord {
  return {
    id: Number(row.id),
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role as AdminRole,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export class AdminAuthRepository {
  async findAdminUserByEmail(email: string): Promise<AdminUserRecord | null> {
    const row = await prisma.adminUser.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } }
    });

    if (!row) return null;
    return mapAdminUser(row);
  }

  async findAdminUserById(id: number): Promise<AdminUserRecord | null> {
    const row = await prisma.adminUser.findUnique({ where: { id: BigInt(id) } });
    if (!row) return null;
    return mapAdminUser(row);
  }

  async createSession(adminUserId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    await prisma.adminSession.create({
      data: {
        adminUserId: BigInt(adminUserId),
        tokenHash,
        expiresAt
      }
    });
  }

  async findSessionPrincipalByTokenHash(tokenHash: string): Promise<SessionPrincipal | null> {
    const session = await prisma.adminSession.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        adminUser: { active: true }
      },
      include: {
        adminUser: {
          select: { id: true, email: true, role: true }
        }
      }
    });

    if (!session) return null;
    return {
      userId: Number(session.adminUser.id),
      email: session.adminUser.email,
      role: session.adminUser.role as AdminRole,
      sessionId: Number(session.id)
    };
  }

  async revokeSessionByTokenHash(tokenHash: string): Promise<void> {
    await prisma.adminSession.updateMany({
      where: {
        tokenHash,
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });
  }

  async createAdminUser(input: {
    email: string;
    passwordHash: string;
    role: AdminRole;
  }): Promise<AdminUserRecord> {
    const row = await prisma.adminUser.upsert({
      where: { email: input.email.toLowerCase() },
      update: {
        passwordHash: input.passwordHash,
        role: input.role,
        active: true,
        updatedAt: new Date()
      },
      create: {
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        role: input.role
      }
    });

    return mapAdminUser(row);
  }
}
