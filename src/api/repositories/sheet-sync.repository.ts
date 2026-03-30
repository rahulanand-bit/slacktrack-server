import { dbPool } from '../../config/db';

export type SheetSyncState = {
  syncKey: string;
  dbHash: string;
  sheetHash: string;
  updatedAt: Date;
};

export class SheetSyncRepository {
  async getState(syncKey: string): Promise<SheetSyncState | null> {
    const result = await dbPool.query(
      `
      SELECT sync_key, db_hash, sheet_hash, updated_at
      FROM sheet_sync_state
      WHERE sync_key = $1
      LIMIT 1
      `,
      [syncKey]
    );

    if ((result.rowCount ?? 0) === 0) return null;
    const row = result.rows[0];
    return {
      syncKey: String(row.sync_key),
      dbHash: String(row.db_hash),
      sheetHash: String(row.sheet_hash),
      updatedAt: row.updated_at as Date
    };
  }

  async upsertState(syncKey: string, dbHash: string, sheetHash: string): Promise<void> {
    await dbPool.query(
      `
      INSERT INTO sheet_sync_state (sync_key, db_hash, sheet_hash)
      VALUES ($1, $2, $3)
      ON CONFLICT (sync_key)
      DO UPDATE SET
        db_hash = EXCLUDED.db_hash,
        sheet_hash = EXCLUDED.sheet_hash,
        updated_at = NOW()
      `,
      [syncKey, dbHash, sheetHash]
    );
  }
}
