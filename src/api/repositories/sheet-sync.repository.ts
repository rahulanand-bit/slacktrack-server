import { prisma } from '../../config/prisma';

export type SheetSyncState = {
  syncKey: string;
  dbHash: string;
  sheetHash: string;
  updatedAt: Date;
};

export class SheetSyncRepository {
  async getState(syncKey: string): Promise<SheetSyncState | null> {
    const row = await prisma.sheetSyncState.findUnique({ where: { syncKey } });
    if (!row) return null;

    return {
      syncKey: row.syncKey,
      dbHash: row.dbHash,
      sheetHash: row.sheetHash,
      updatedAt: row.updatedAt
    };
  }

  async upsertState(syncKey: string, dbHash: string, sheetHash: string): Promise<void> {
    await prisma.sheetSyncState.upsert({
      where: { syncKey },
      update: {
        dbHash,
        sheetHash,
        updatedAt: new Date()
      },
      create: {
        syncKey,
        dbHash,
        sheetHash
      }
    });
  }
}
