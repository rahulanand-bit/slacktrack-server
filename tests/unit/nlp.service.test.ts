import { describe, expect, it } from 'vitest';
import { NlpService } from '../../src/api/services/nlp.service';

describe('NlpService', () => {
  const service = new NlpService();

  it('parses attendance intent from chat text', async () => {
    const intent = await service.parse('WFH today');
    expect(intent.attendanceValue).toBe('WFH');
    expect(intent.dateYmds.length).toBe(1);
    expect(intent.ambiguous).toBe(false);
  });

  it('parses explicit date from chat text', async () => {
    const intent = await service.parse('WFO 30 march');
    expect(intent.attendanceValue).toBe('WFO');
    expect(intent.dateYmd).toMatch(/^\d{4}-03-30$/);
    expect(intent.dateYmds).toEqual([intent.dateYmd]);
  });

  it('parses date range from chat text', async () => {
    const intent = await service.parse('leave from 30 march to 2 april');
    expect(intent.attendanceValue).toBe('-1');
    expect(intent.isRange).toBe(true);
    expect(intent.dateYmds.length).toBe(4);
  });

  it('parses project list intent from chat text', async () => {
    const intent = await service.parse('Projects today: Alpha, Beta');
    expect(intent.projects).toEqual(['Alpha', 'Beta']);
    expect(intent.ambiguous).toBe(false);
  });

  it('marks unknown sentence as ambiguous', async () => {
    const intent = await service.parse('hello there');
    expect(intent.ambiguous).toBe(true);
  });
});
