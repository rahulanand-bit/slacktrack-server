import type { HolidayEntry, HolidayRepository } from '../repositories/holiday.repository';

export class HolidayService {
  constructor(private readonly holidayRepository: HolidayRepository) {}

  async listHolidays(): Promise<HolidayEntry[]> {
    return this.holidayRepository.listAll();
  }

  async replaceHolidays(entries: HolidayEntry[]): Promise<HolidayEntry[]> {
    const deduped = new Map<string, string>();
    for (const entry of entries) {
      deduped.set(entry.dateYmd, entry.holidayName.trim());
    }

    const normalized = Array.from(deduped.entries())
      .map(([dateYmd, holidayName]) => ({ dateYmd, holidayName }))
      .sort((a, b) => a.dateYmd.localeCompare(b.dateYmd));

    await this.holidayRepository.replaceAll(normalized);
    return normalized;
  }
}
