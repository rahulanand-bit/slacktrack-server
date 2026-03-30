import { dbPool } from '../../config/db';
import type { UserRecord } from './models';

type CreateUserInput = {
  slackUserId: string;
  displayName?: string | null;
  email?: string | null;
  isMessageEnabled?: boolean;
};

function mapUserRow(row: {
  id: number;
  slack_user_id: string;
  display_name: string | null;
  email: string | null;
  is_message_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}): UserRecord {
  return {
    id: row.id,
    slackUserId: row.slack_user_id,
    displayName: row.display_name,
    email: row.email,
    isMessageEnabled: row.is_message_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class UserRepository {
  async upsertBySlackId(slackUserId: string, displayName?: string): Promise<UserRecord> {
    const result = await dbPool.query(
      `
      INSERT INTO users (slack_user_id, display_name)
      VALUES ($1, $2)
      ON CONFLICT (slack_user_id)
      DO UPDATE SET
        display_name = COALESCE(EXCLUDED.display_name, users.display_name),
        updated_at = NOW()
      RETURNING id, slack_user_id, display_name, email, is_message_enabled, created_at, updated_at
      `,
      [slackUserId, displayName || null]
    );

    return mapUserRow(result.rows[0]);
  }

  async createOrUpdateUser(input: CreateUserInput): Promise<UserRecord> {
    const result = await dbPool.query(
      `
      INSERT INTO users (slack_user_id, display_name, email, is_message_enabled)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (slack_user_id)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        email = EXCLUDED.email,
        is_message_enabled = EXCLUDED.is_message_enabled,
        updated_at = NOW()
      RETURNING id, slack_user_id, display_name, email, is_message_enabled, created_at, updated_at
      `,
      [
        input.slackUserId,
        input.displayName || null,
        input.email || null,
        input.isMessageEnabled ?? true
      ]
    );

    return mapUserRow(result.rows[0]);
  }

  async setMessagingEnabled(slackUserId: string, isMessageEnabled: boolean): Promise<UserRecord | null> {
    const result = await dbPool.query(
      `
      UPDATE users
      SET is_message_enabled = $2,
          updated_at = NOW()
      WHERE slack_user_id = $1
      RETURNING id, slack_user_id, display_name, email, is_message_enabled, created_at, updated_at
      `,
      [slackUserId, isMessageEnabled]
    );

    if (result.rowCount === 0) return null;
    return mapUserRow(result.rows[0]);
  }

  async findBySlackId(slackUserId: string): Promise<UserRecord | null> {
    const result = await dbPool.query(
      `
      SELECT id, slack_user_id, display_name, email, is_message_enabled, created_at, updated_at
      FROM users
      WHERE slack_user_id = $1
      LIMIT 1
      `,
      [slackUserId]
    );

    if (result.rowCount === 0) return null;
    return mapUserRow(result.rows[0]);
  }

  async listAllSlackUserIds(): Promise<string[]> {
    const result = await dbPool.query(`SELECT slack_user_id FROM users ORDER BY id ASC`);
    return result.rows.map((row) => String(row.slack_user_id));
  }

  async listMessageEnabledSlackUserIds(): Promise<string[]> {
    const result = await dbPool.query(
      `
      SELECT slack_user_id
      FROM users
      WHERE is_message_enabled = TRUE
      ORDER BY id ASC
      `
    );

    return result.rows.map((row) => String(row.slack_user_id));
  }

  async listUsers(): Promise<UserRecord[]> {
    const result = await dbPool.query(
      `
      SELECT id, slack_user_id, display_name, email, is_message_enabled, created_at, updated_at
      FROM users
      ORDER BY COALESCE(display_name, slack_user_id) ASC
      `
    );

    return result.rows.map((row) => mapUserRow(row));
  }
}
