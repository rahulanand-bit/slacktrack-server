import { prisma } from '../../config/prisma';
import { dateToYmd, ymdToDate } from '../../utils/date-ymd';

export type HolidayEntry = {
  dateYmd: string;
  holidayName: string;
};

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

  async listAll(): Promise<HolidayEntry[]> {
    const rows = await prisma.holiday.findMany({
      orderBy: { dateYmd: 'asc' },
      select: {
        dateYmd: true,
        holidayName: true
      }
    });

    return rows.map((row) => ({
      dateYmd: dateToYmd(row.dateYmd),
      holidayName: row.holidayName
    }));
  }

  async replaceAll(entries: HolidayEntry[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.holiday.deleteMany({});
      if (entries.length === 0) return;
      await tx.holiday.createMany({
        data: entries.map((entry) => ({
          dateYmd: ymdToDate(entry.dateYmd),
          holidayName: entry.holidayName
        }))
      });
    });
  }

  async upsertMany(entries: HolidayEntry[]): Promise<void> {
    for (const entry of entries) {
      await prisma.holiday.upsert({
        where: { dateYmd: ymdToDate(entry.dateYmd) },
        update: { holidayName: entry.holidayName },
        create: {
          dateYmd: ymdToDate(entry.dateYmd),
          holidayName: entry.holidayName
        }
      });
    }
  }
}
