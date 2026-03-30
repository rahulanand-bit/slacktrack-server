import type { UserRecord } from '../repositories/models';
import type { UserRepository } from '../repositories/user.repository';

export type CreateUserInput = {
  slackId: string;
  name: string;
  email?: string | null;
  isMessageEnabled?: boolean;
};

export class UserAdminService {
  constructor(private readonly userRepository: UserRepository) {}

  async listUsers(): Promise<UserRecord[]> {
    return this.userRepository.listUsers();
  }

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    return this.userRepository.createOrUpdateUser({
      slackUserId: input.slackId,
      displayName: input.name,
      email: input.email ?? null,
      isMessageEnabled: input.isMessageEnabled ?? true
    });
  }

  async deactivateMessaging(slackUserId: string): Promise<UserRecord | null> {
    return this.userRepository.setMessagingEnabled(slackUserId, false);
  }
}
