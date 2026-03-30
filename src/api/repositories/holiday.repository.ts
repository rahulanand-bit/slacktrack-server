import { dbPool } from '../../config/db';

export class HolidayRepository {
  async isHoliday(dateYmd: string): Promise<boolean> {
    const result = await dbPool.query(
      `
      SELECT 1
      FROM holidays
      WHERE date_ymd = $1
      LIMIT 1
      `,
      [dateYmd]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listAllDateYmd(): Promise<string[]> {
    const result = await dbPool.query(`SELECT date_ymd FROM holidays ORDER BY date_ymd ASC`);
    return result.rows.map((row) => String(row.date_ymd));
  }
}
