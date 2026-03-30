import type { Request, Response } from 'express';
import type { SheetSyncService } from '../services/sheet-sync.service';

export class SyncController {
  constructor(private readonly sheetSyncService: SheetSyncService) {}

  async enqueueManualReconcile(_req: Request, res: Response): Promise<void> {
    await this.sheetSyncService.enqueueManualReconcile();
    res.status(202).json({ ok: true, message: 'Reconcile job queued' });
  }
}
