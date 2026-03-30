import { describe, expect, it } from 'vitest';
import { NlpService } from '../../src/api/services/nlp.service';

describe('NlpService', () => {
  const service = new NlpService();

  it('parses attendance intent from chat text', async () => {
    const intent = await service.parse('WFH today');
    expect(intent.attendanceValue).toBe('WFH');
    expect(intent.ambiguous).toBe(false);
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
