import { dbPool } from '../config/db';
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
  for (const user of users) {
    await dbPool.query(
      `
      INSERT INTO users (slack_user_id, display_name, email, is_message_enabled)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (slack_user_id)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        email = EXCLUDED.email,
        is_message_enabled = EXCLUDED.is_message_enabled,
        updated_at = NOW()
      `,
      [user.slackUserId, user.displayName, user.email, user.isMessageEnabled]
    );
  }

  logger.info({ count: users.length }, 'Seeded test users');
}

void seed()
  .catch((error: Error) => {
    logger.error({ error: error.message }, 'Failed to seed test users');
    process.exitCode = 1;
  })
  .finally(async () => {
    await dbPool.end();
  });
