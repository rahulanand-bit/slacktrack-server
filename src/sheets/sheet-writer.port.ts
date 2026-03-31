import type { AttendanceProjectSnapshotRow, UserRecord } from '../api/repositories/models';

export type MonthSheetProjectionInput = {
  sheetName: string;
  monthStartYmd: string;
  timezone: string;
  users: UserRecord[];
  entries: AttendanceProjectSnapshotRow[];
  projectDelimiter: string;
  holidayDateYmds: string[];
};

export interface SheetWriterPort {
  readSheetHash(sheetName: string): Promise<string>;
  writeMonthProjection(input: MonthSheetProjectionInput): Promise<string>;
}
