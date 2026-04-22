import type { UserRecord } from '../repositories/models';
import type { UserRepository } from '../repositories/user.repository';
import { Prisma } from '@prisma/client';

export type CreateUserInput = {
  slackId: string;
  name: string;
  email?: string | null;
  isMessageEnabled?: boolean;
};

export class UserAdminService {
  constructor(private readonly userRepository: UserRepository) {}

  async listUsers(options?: { includeInactive?: boolean }): Promise<UserRecord[]> {
    return this.userRepository.listUsers(options);
  }

  async createUser(input: CreateUserInput): Promise<UserRecord | null> {
    try {
      return await this.userRepository.createUser({
        slackUserId: input.slackId,
        displayName: input.name,
        email: input.email ?? null,
        isMessageEnabled: input.isMessageEnabled ?? true
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return null;
      }
      throw error;
    }
  }

  async createUsersBulk(inputs: CreateUserInput[]): Promise<{
    created: UserRecord[];
    errors: Array<{ slackId: string; reason: string }>;
  }> {
    const created: UserRecord[] = [];
    const errors: Array<{ slackId: string; reason: string }> = [];

    for (const input of inputs) {
      const result = await this.createUser(input);
      if (!result) {
        errors.push({ slackId: input.slackId, reason: 'Duplicate slackId' });
        continue;
      }
      created.push(result);
    }

    return { created, errors };
  }

  async updateUser(
    slackUserId: string,
    input: { name?: string; email?: string | null; isMessageEnabled?: boolean }
  ): Promise<UserRecord | null> {
    return this.userRepository.updateUserBySlackId(slackUserId, {
      displayName: input.name,
      email: input.email,
      isMessageEnabled: input.isMessageEnabled
    });
  }

  async setMessagingEnabled(slackUserId: string, isMessageEnabled: boolean): Promise<UserRecord | null> {
    return this.userRepository.setMessagingEnabled(slackUserId, isMessageEnabled);
  }

  async deactivateMessaging(slackUserId: string): Promise<UserRecord | null> {
    return this.userRepository.setMessagingEnabled(slackUserId, false);
  }

  async archiveUser(slackUserId: string): Promise<UserRecord | null> {
    return this.userRepository.archiveBySlackId(slackUserId);
  }

  async restoreUser(slackUserId: string): Promise<UserRecord | null> {
    return this.userRepository.restoreBySlackId(slackUserId);
  }
}
