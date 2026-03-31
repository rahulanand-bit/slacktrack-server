import { DateTime } from 'luxon';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { JobPublisher } from '../../queues/contracts/job-publisher';
import { sha256 } from '../../utils/hash';
import type { AttendanceRepository } from '../repositories/attendance.repository';
import type { HolidayRepository } from '../repositories/holiday.repository';
import type { SheetSyncRepository } from '../repositories/sheet-sync.repository';
import type { UserRepository } from '../repositories/user.repository';
import type { SheetWriterPort } from '../../sheets/sheet-writer.port';

export class SheetSyncService {
  constructor(
    private readonly attendanceRepository: AttendanceRepository,
    private readonly sheetSyncRepository: SheetSyncRepository,
    private readonly userRepository: UserRepository,
    private readonly holidayRepository: HolidayRepository,
    private readonly sheetWriter: SheetWriterPort,
    private readonly jobPublisher: JobPublisher
  ) {}

  async enqueueManualReconcile(): Promise<void> {
    await this.jobPublisher.publishSheetReconcile({ reason: 'manual' });
  }

  async reconcile(reason: 'periodic' | 'manual'): Promise<void> {
    const now = DateTime.now().setZone(env.TIMEZONE);
    const users = await this.userRepository.listUsers();
    const holidayDateYmds = await this.holidayRepository.listAllDateYmd();

    const months = [now.startOf('month'), now.plus({ months: 1 }).startOf('month')];
    for (const monthStart of months) {
      const fromDateYmd = monthStart.toFormat('yyyy-LL-dd');
      const toDateYmd = monthStart.endOf('month').toFormat('yyyy-LL-dd');
      const snapshotRows = await this.attendanceRepository.listSnapshotRows(fromDateYmd, toDateYmd);

      const dbHash = sha256(
        JSON.stringify({
          users: users.map((user) => [user.slackUserId, user.displayName]),
          rows: snapshotRows,
          holidays: holidayDateYmds
        })
      );

      const syncKey = `projection:${monthStart.toFormat('yyyy-LL')}`;
      const sheetName = monthStart.toFormat('LLLL yyyy');
      const state = await this.sheetSyncRepository.getState(syncKey);
      const sheetHash = await this.sheetWriter.readSheetHash(sheetName);
      const inSync = Boolean(state && state.dbHash === dbHash && state.sheetHash === sheetHash);

      if (inSync) {
        logger.info({ reason, syncKey, sheetName }, 'Sheet reconcile skipped (already in sync)');
        continue;
      }

      const updatedSheetHash = await this.sheetWriter.writeMonthProjection({
        sheetName,
        monthStartYmd: fromDateYmd,
        timezone: env.TIMEZONE,
        users,
        entries: snapshotRows,
        projectDelimiter: env.PROJECT_LIST_DELIMITER,
        holidayDateYmds
      });

      await this.sheetSyncRepository.upsertState(syncKey, dbHash, updatedSheetHash);
      logger.info(
        {
          reason,
          syncKey,
          sheetName,
          users: users.length,
          rows: snapshotRows.length
        },
        'Sheet reconcile completed'
      );
    }
  }
}
