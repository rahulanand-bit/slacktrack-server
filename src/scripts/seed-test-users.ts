import { UserRepository } from '../api/repositories/user.repository';
import { prisma } from '../config/prisma';
import { slackUserNotificationSeed } from '../config/slack-user-notification.seed';
import { logger } from '../config/logger';

type SeedUser = {
  slackUserId: string;
  displayName: string;
  email: string | null;
  isMessageEnabled: boolean;
};

function buildSeedUsers(): SeedUser[] {
  if (slackUserNotificationSeed.length) {
    return slackUserNotificationSeed.map((user) => ({
      slackUserId: user.slackId,
      displayName: user.name,
      email: user.email,
      isMessageEnabled: user.isMessageEnabled
    }));
  }

  return [
    { slackUserId: 'U_TEST_001', displayName: 'Test User 1', email: null, isMessageEnabled: true },
    { slackUserId: 'U_TEST_002', displayName: 'Test User 2', email: null, isMessageEnabled: true },
    { slackUserId: 'U_TEST_003', displayName: 'Test User 3', email: null, isMessageEnabled: true }
  ];
}

async function seed(): Promise<void> {
  const users = buildSeedUsers();
  const userRepository = new UserRepository();

  for (const user of users) {
    await userRepository.createOrUpdateUser({
      slackUserId: user.slackUserId,
      displayName: user.displayName,
      email: user.email,
      isMessageEnabled: user.isMessageEnabled
    });
  }

  logger.info({ count: users.length }, 'Seeded test users');
}

void seed()
  .catch((error: Error) => {
    logger.error({ error: error.message }, 'Failed to seed test users');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
