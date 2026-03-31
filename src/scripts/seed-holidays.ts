import { HolidayRepository } from '../api/repositories/holiday.repository';
import { logger } from '../config/logger';
import { prisma } from '../config/prisma';
import { holidayYmdSeed } from '../config/holiday.seed';

async function seedHolidays(): Promise<void> {
  const repository = new HolidayRepository();
  const entries = holidayYmdSeed.map((dateYmd) => ({
    dateYmd,
    holidayName: 'Holiday'
  }));

  await repository.upsertMany(entries);
  logger.info({ count: entries.length }, 'Seeded holidays');
}

void seedHolidays()
  .catch((error: Error) => {
    logger.error({ error: error.message }, 'Failed to seed holidays');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
