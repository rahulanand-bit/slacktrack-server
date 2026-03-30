export function ymdToDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

export function dateToYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}
