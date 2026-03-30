import { prisma } from '../../config/prisma';
import type { UserRecord } from './models';

type CreateUserInput = {
  slackUserId: string;
  displayName?: string | null;
  email?: string | null;
  isMessageEnabled?: boolean;
};

function mapUserRecord(row: {
  id: bigint;
  slackUserId: string;
  displayName: string | null;
  email: string | null;
  isMessageEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): UserRecord {
  return {
    id: Number(row.id),
    slackUserId: row.slackUserId,
    displayName: row.displayName,
    email: row.email,
    isMessageEnabled: row.isMessageEnabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export class UserRepository {
  async upsertBySlackId(slackUserId: string, displayName?: string): Promise<UserRecord> {
    const user = await prisma.user.upsert({
      where: { slackUserId },
      update: {
        displayName: displayName ?? undefined,
        updatedAt: new Date()
      },
      create: {
        slackUserId,
        displayName: displayName || null
      }
    });

    return mapUserRecord(user);
  }

  async createOrUpdateUser(input: CreateUserInput): Promise<UserRecord> {
    const user = await prisma.user.upsert({
      where: { slackUserId: input.slackUserId },
      update: {
        displayName: input.displayName || null,
        email: input.email || null,
        isMessageEnabled: input.isMessageEnabled ?? true,
        updatedAt: new Date()
      },
      create: {
        slackUserId: input.slackUserId,
        displayName: input.displayName || null,
        email: input.email || null,
        isMessageEnabled: input.isMessageEnabled ?? true
      }
    });

    return mapUserRecord(user);
  }

  async setMessagingEnabled(slackUserId: string, isMessageEnabled: boolean): Promise<UserRecord | null> {
    const user = await prisma.user.findUnique({ where: { slackUserId } });
    if (!user) return null;

    const updated = await prisma.user.update({
      where: { slackUserId },
      data: {
        isMessageEnabled,
        updatedAt: new Date()
      }
    });

    return mapUserRecord(updated);
  }

  async updateUserBySlackId(
    slackUserId: string,
    input: { displayName?: string | null; email?: string | null; isMessageEnabled?: boolean }
  ): Promise<UserRecord | null> {
    const user = await prisma.user.findUnique({ where: { slackUserId } });
    if (!user) return null;

    const updated = await prisma.user.update({
      where: { slackUserId },
      data: {
        displayName: input.displayName ?? user.displayName,
        email: input.email ?? user.email,
        isMessageEnabled: input.isMessageEnabled ?? user.isMessageEnabled,
        updatedAt: new Date()
      }
    });

    return mapUserRecord(updated);
  }

  async findBySlackId(slackUserId: string): Promise<UserRecord | null> {
    const user = await prisma.user.findUnique({ where: { slackUserId } });
    if (!user) return null;
    return mapUserRecord(user);
  }

  async listAllSlackUserIds(): Promise<string[]> {
    const users = await prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: { slackUserId: true }
    });

    return users.map((row) => row.slackUserId);
  }

  async listMessageEnabledSlackUserIds(): Promise<string[]> {
    const users = await prisma.user.findMany({
      where: { isMessageEnabled: true },
      orderBy: { id: 'asc' },
      select: { slackUserId: true }
    });

    return users.map((row) => row.slackUserId);
  }

  async listUsers(): Promise<UserRecord[]> {
    const users = await prisma.user.findMany({
      orderBy: [{ displayName: 'asc' }, { slackUserId: 'asc' }]
    });

    return users.map((row) => mapUserRecord(row));
  }
}
