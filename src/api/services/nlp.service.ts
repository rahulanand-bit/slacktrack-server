import { DateTime } from 'luxon';
import { env } from '../../config/env';
import type { AttendanceValue } from '../repositories/models';

export type ParsedChatIntent = {
  dateYmd: string;
  dateYmds: string[];
  isRange: boolean;
  attendanceValue: AttendanceValue | null;
  projects: string[];
  ambiguous: boolean;
};

export class NlpService {
  private static readonly monthPattern =
    '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

  async parse(text: string): Promise<ParsedChatIntent> {
    const fallback = this.parseHeuristics(text);
    if (!fallback.ambiguous || !env.GEMINI_API_KEY) return fallback;

    try {
      const gemini = await this.parseWithGemini(text);
      return {
        dateYmd: gemini.dateYmd || fallback.dateYmd,
        dateYmds: [gemini.dateYmd || fallback.dateYmd],
        isRange: false,
        attendanceValue: gemini.attendanceValue,
        projects: gemini.projects,
        ambiguous: gemini.ambiguous
      };
    } catch {
      return fallback;
    }
  }

  private parseHeuristics(text: string): ParsedChatIntent {
    const normalized = text.trim();
    const lower = normalized.toLowerCase();

    const today = DateTime.now().setZone(env.TIMEZONE);
    let targetDate = today;
    if (lower.includes('tomorrow')) targetDate = today.plus({ days: 1 });
    if (lower.includes('yesterday')) targetDate = today.minus({ days: 1 });

    const parsedRange = this.extractDateRange(normalized, today);
    let dateYmds: string[] = [];
    let isRange = false;
    if (parsedRange) {
      dateYmds = this.expandRange(parsedRange.start, parsedRange.end);
      isRange = true;
    } else {
      const parsedSingleDate = this.extractSingleDate(normalized, today);
      if (parsedSingleDate) {
        targetDate = parsedSingleDate;
      }
      dateYmds = [targetDate.toFormat('yyyy-LL-dd')];
    }

    let attendanceValue: AttendanceValue | null = null;
    if (/\bwfo\b|office/.test(lower)) attendanceValue = 'WFO';
    else if (/\bwfh\b|work from home|home/.test(lower)) attendanceValue = 'WFH';
    else if (/half\s*day|halfday|0\.5/.test(lower)) attendanceValue = '-0.5';
    else if (/\bleave\b|day\s*off/.test(lower)) attendanceValue = '-1';

    const projects = this.extractProjectList(normalized);
    const hasIntent = attendanceValue !== null || projects.length > 0;

    return {
      dateYmd: dateYmds[0],
      dateYmds,
      isRange,
      attendanceValue,
      projects,
      ambiguous: !hasIntent
    };
  }

  private extractDateRange(text: string, referenceDate: DateTime): { start: DateTime; end: DateTime } | null {
    const tokenPattern = `[0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}(?:st|nd|rd|th)?\\s+${NlpService.monthPattern}(?:\\s+[0-9]{4})?|${NlpService.monthPattern}\\s+[0-9]{1,2}(?:st|nd|rd|th)?(?:\\s+[0-9]{4})?`;
    const pattern = new RegExp(`(?:from\\s+)?(${tokenPattern})\\s*(?:to|until|through|-)\\s*(${tokenPattern})`, 'i');

    const match = text.match(pattern);
    if (!match) return null;

    const left = this.parseDateToken(match[1], referenceDate);
    const right = this.parseDateToken(match[2], referenceDate);
    if (!left || !right) return null;

    if (right < left) {
      return { start: right, end: left };
    }

    return { start: left, end: right };
  }

  private extractSingleDate(text: string, referenceDate: DateTime): DateTime | null {
    const tokenPattern = `[0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}(?:st|nd|rd|th)?\\s+${NlpService.monthPattern}(?:\\s+[0-9]{4})?|${NlpService.monthPattern}\\s+[0-9]{1,2}(?:st|nd|rd|th)?(?:\\s+[0-9]{4})?`;
    const pattern = new RegExp(tokenPattern, 'gi');
    const matches = text.match(pattern) || [];
    for (const token of matches) {
      const parsed = this.parseDateToken(token, referenceDate);
      if (parsed) return parsed;
    }
    return null;
  }

  private parseDateToken(token: string, referenceDate: DateTime): DateTime | null {
    const cleaned = token
      .trim()
      .replace(/(\d)(st|nd|rd|th)/gi, '$1')
      .replace(/\s+/g, ' ');
    const normalizedCase = cleaned
      .split(' ')
      .map((part) => (/^[a-zA-Z]+$/.test(part) ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : part))
      .join(' ');

    if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedCase)) {
      const iso = DateTime.fromISO(normalizedCase, { zone: env.TIMEZONE });
      return iso.isValid ? iso.startOf('day') : null;
    }

    const hasYear = /\b\d{4}\b/.test(normalizedCase);
    const withYear = hasYear ? normalizedCase : `${normalizedCase} ${referenceDate.year}`;
    const formats = ['d LLLL yyyy', 'd LLL yyyy', 'LLLL d yyyy', 'LLL d yyyy'];

    for (const format of formats) {
      const parsed = DateTime.fromFormat(withYear, format, { zone: env.TIMEZONE, locale: 'en' });
      if (parsed.isValid) return parsed.startOf('day');
    }

    return null;
  }

  private expandRange(start: DateTime, end: DateTime): string[] {
    const dates: string[] = [];
    let cursor = start;
    while (cursor <= end) {
      dates.push(cursor.toFormat('yyyy-LL-dd'));
      cursor = cursor.plus({ days: 1 });
    }
    return dates;
  }

  private extractProjectList(text: string): string[] {
    const patterns = [
      /projects?\s*(?:today)?\s*[:=-]\s*(.+)$/i,
      /set\s+my\s+projects?\s+for\s+today(?:\s+as)?\s+(.+)$/i,
      /update\s+my\s+projects?\s+for\s+today(?:\s+as)?\s+(.+)$/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match || !match[1]) continue;
      return match[1]
        .split(/,|\|/)
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, env.MAX_PROJECTS_PER_DAY);
    }

    return [];
  }

  private async parseWithGemini(text: string): Promise<ParsedChatIntent> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
    const prompt = [
      'Extract attendance and projects intent from the message.',
      'Return JSON only with keys:',
      '{"dateYmd":"YYYY-MM-DD","attendanceValue":"WFO|WFH|-1|-0.5|null","projects":["..."],"ambiguous":boolean}',
      `Max projects: ${env.MAX_PROJECTS_PER_DAY}`,
      `Message: ${text}`
    ].join('\n');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) throw new Error(`Gemini request failed: ${response.status}`);
    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const jsonText = this.extractJson(rawText);
    const parsed = JSON.parse(jsonText) as {
      dateYmd?: string;
      attendanceValue?: string | null;
      projects?: string[];
      ambiguous?: boolean;
    };

    const attendance = parsed.attendanceValue;
    const attendanceValue: AttendanceValue | null =
      attendance === 'WFO' || attendance === 'WFH' || attendance === '-1' || attendance === '-0.5'
        ? attendance
        : null;

    return {
      dateYmd: parsed.dateYmd || DateTime.now().setZone(env.TIMEZONE).toFormat('yyyy-LL-dd'),
      dateYmds: [parsed.dateYmd || DateTime.now().setZone(env.TIMEZONE).toFormat('yyyy-LL-dd')],
      isRange: false,
      attendanceValue,
      projects: Array.isArray(parsed.projects)
        ? parsed.projects.map((project) => String(project).trim()).filter(Boolean).slice(0, env.MAX_PROJECTS_PER_DAY)
        : [],
      ambiguous: Boolean(parsed.ambiguous)
    };
  }

  private extractJson(text: string): string {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return '{}';
    return text.slice(start, end + 1);
  }
}
