import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SheetSyncService } from '../../src/api/services/sheet-sync.service';
import type { AttendanceRepository } from '../../src/api/repositories/attendance.repository';
import type { SheetSyncRepository } from '../../src/api/repositories/sheet-sync.repository';
import type { UserRepository } from '../../src/api/repositories/user.repository';
import type { JobPublisher } from '../../src/queues/contracts/job-publisher';
import type { SheetWriterPort } from '../../src/sheets/sheet-writer.port';

describe('SheetSyncService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T10:00:00.000Z'));
  });

  it('reconciles current and next month sheets', async () => {
    const attendanceRepository = {
      listSnapshotRows: vi.fn(async () => [])
    } as unknown as AttendanceRepository;

    const sheetSyncRepository = {
      getState: vi.fn(async () => null),
      upsertState: vi.fn(async () => undefined)
    } as unknown as SheetSyncRepository;

    const userRepository = {
      listUsers: vi.fn(async () => [
        {
          id: 1,
          slackUserId: 'U1',
          displayName: 'User 1',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])
    } as unknown as UserRepository;

    const sheetWriter = {
      readSheetHash: vi.fn(async () => 'sheet-old-hash'),
      writeMonthProjection: vi.fn(async () => 'sheet-new-hash')
    } as unknown as SheetWriterPort;

    const jobPublisher = {
      publishSheetReconcile: vi.fn(async () => undefined)
    } as unknown as JobPublisher;

    const service = new SheetSyncService(
      attendanceRepository,
      sheetSyncRepository,
      userRepository,
      sheetWriter,
      jobPublisher
    );

    await service.reconcile('manual');

    expect(sheetWriter.writeMonthProjection).toHaveBeenCalledTimes(2);
    expect(sheetSyncRepository.upsertState).toHaveBeenCalledTimes(2);
  });
});
