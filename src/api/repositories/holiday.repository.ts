import { prisma } from '../../config/prisma';
import { dateToYmd, ymdToDate } from '../../utils/date-ymd';

export class HolidayRepository {
  async isHoliday(dateYmd: string): Promise<boolean> {
    const count = await prisma.holiday.count({
      where: { dateYmd: ymdToDate(dateYmd) }
    });

    return count > 0;
  }

  async listAllDateYmd(): Promise<string[]> {
    const rows = await prisma.holiday.findMany({
      orderBy: { dateYmd: 'asc' },
      select: { dateYmd: true }
    });

    return rows.map((row) => dateToYmd(row.dateYmd));
  }
}
