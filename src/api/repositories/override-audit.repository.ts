import { dbPool } from '../../config/db';

export type OverrideAuditInput = {
  overrideType: 'attendance' | 'projects';
  slackUserId: string;
  dateYmd: string;
  payloadJson: Record<string, unknown>;
  actorId: string;
};

export class OverrideAuditRepository {
  async insertAudit(input: OverrideAuditInput): Promise<void> {
    await dbPool.query(
      `
      INSERT INTO manual_override_audit (override_type, slack_user_id, date_ymd, payload_json, actor_id)
      VALUES ($1, $2, $3, $4::jsonb, $5)
      `,
      [
        input.overrideType,
        input.slackUserId,
        input.dateYmd,
        JSON.stringify(input.payloadJson),
        input.actorId
      ]
    );
  }
}
