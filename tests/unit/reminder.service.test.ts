import { describe, expect, it } from 'vitest';
import { isWeekend } from '../../src/api/services/reminder.service';

describe('ReminderService policy helpers', () => {
  it('detects weekend for Saturday and Sunday', () => {
    expect(isWeekend(6)).toBe(true);
    expect(isWeekend(7)).toBe(true);
  });

  it('does not mark weekdays as weekend', () => {
    expect(isWeekend(1)).toBe(false);
    expect(isWeekend(3)).toBe(false);
    expect(isWeekend(5)).toBe(false);
  });
});
