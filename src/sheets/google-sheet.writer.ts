import { DateTime } from 'luxon';
import { google, type sheets_v4 } from 'googleapis';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { sha256 } from '../utils/hash';
import type { MonthSheetProjectionInput, SheetWriterPort } from './sheet-writer.port';

type Rgb = { red: number; green: number; blue: number };

const HEADER_BG: Rgb = { red: 0.82, green: 0.82, blue: 0.82 };
const WEEKEND_HEADER_BG: Rgb = { red: 0.94, green: 0.62, blue: 0.68 };
const WEEKEND_BODY_BG: Rgb = { red: 0.99, green: 0.88, blue: 0.9 };

const PROJECT_PALETTE: Rgb[] = [
  { red: 0.96, green: 0.88, blue: 0.64 },
  { red: 0.78, green: 0.91, blue: 0.8 },
  { red: 0.78, green: 0.86, blue: 0.98 },
  { red: 0.93, green: 0.8, blue: 0.95 },
  { red: 0.99, green: 0.84, blue: 0.75 },
  { red: 0.84, green: 0.92, blue: 0.96 },
  { red: 0.92, green: 0.96, blue: 0.79 },
  { red: 0.96, green: 0.81, blue: 0.84 }
];

export class GoogleSheetWriter implements SheetWriterPort {
  async readSheetHash(sheetName: string): Promise<string> {
    const sheets = await this.getSheetsClient();
    if (!sheets || !env.SPREADSHEET_ID) {
      logger.warn({ sheetName }, 'Skipping sheet hash read because Google Sheets credentials are not configured');
      return 'sheet-disabled';
    }

    await this.ensureTabExists(sheets, env.SPREADSHEET_ID, sheetName);
    const range = `${sheetName}!A1:AZ`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: env.SPREADSHEET_ID,
      range
    });

    return sha256(JSON.stringify(response.data.values || []));
  }

  async writeMonthProjection(input: MonthSheetProjectionInput): Promise<string> {
    const values = this.buildMonthValues(input);
    const hash = sha256(JSON.stringify(values));

    const sheets = await this.getSheetsClient();
    if (!sheets || !env.SPREADSHEET_ID) {
      logger.warn({ sheetName: input.sheetName }, 'Skipping sheet write because Google Sheets credentials are not configured');
      return 'sheet-disabled';
    }

    const sheetId = await this.ensureTabExists(sheets, env.SPREADSHEET_ID, input.sheetName);
    await this.writeValues(sheets, env.SPREADSHEET_ID, input.sheetName, values);
    await this.applyFormatting(sheets, env.SPREADSHEET_ID, sheetId, values, input);
    return hash;
  }

  private buildMonthValues(input: MonthSheetProjectionInput): string[][] {
    const monthStart = DateTime.fromISO(input.monthStartYmd, { zone: input.timezone }).startOf('month');
    const daysInMonth = monthStart.daysInMonth || 30;
    const header = ['UserName', 'SlackID', 'Email'];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = monthStart.set({ day });
      header.push(`${date.toFormat('ccc')} ${day}`);
    }

    const entryMap = new Map<string, { status: string; projects: string[] }>();
    for (const entry of input.entries) {
      entryMap.set(`${entry.slackUserId}:${entry.dateYmd}`, {
        status: entry.status || '',
        projects: entry.projects
      });
    }

    const values: string[][] = [header];
    for (const user of input.users) {
      const statusRow = new Array(3 + daysInMonth).fill('');
      const projectRow = new Array(3 + daysInMonth).fill('');
      statusRow[0] = user.displayName || user.slackUserId;
      statusRow[1] = user.slackUserId;
      statusRow[2] = user.email || '';

      for (let day = 1; day <= daysInMonth; day++) {
        const dateYmd = monthStart.set({ day }).toFormat('yyyy-LL-dd');
        const key = `${user.slackUserId}:${dateYmd}`;
        const entry = entryMap.get(key);
        const col = 3 + (day - 1);
        statusRow[col] = entry?.status || '';
        projectRow[col] = (entry?.projects || []).join(` ${input.projectDelimiter} `);
      }

      values.push(statusRow, projectRow);
    }

    return values;
  }

  private async writeValues(
    sheets: sheets_v4.Sheets,
    spreadsheetId: string,
    sheetName: string,
    values: string[][]
  ): Promise<void> {
    const range = `${sheetName}!A1:AZ`;
    await sheets.spreadsheets.values.clear({ spreadsheetId, range });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values }
    });
  }

  private async applyFormatting(
    sheets: sheets_v4.Sheets,
    spreadsheetId: string,
    sheetId: number,
    values: string[][],
    input: MonthSheetProjectionInput
  ): Promise<void> {
    const rowCount = values.length;
    const colCount = values[0]?.length || 2;
    const monthStart = DateTime.fromISO(input.monthStartYmd, { zone: input.timezone }).startOf('month');
    const daysInMonth = monthStart.daysInMonth || 30;
    const totalUsers = Math.floor((rowCount - 1) / 2);

    const requests: sheets_v4.Schema$Request[] = [
      {
        unmergeCells: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: rowCount,
            startColumnIndex: 0,
            endColumnIndex: 3
          }
        }
      },
      {
        updateSheetProperties: {
          properties: {
            sheetId,
            gridProperties: {
              frozenRowCount: 0,
              frozenColumnCount: 0
            }
          },
          fields: 'gridProperties.frozenRowCount,gridProperties.frozenColumnCount'
        }
      },
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: colCount
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: HEADER_BG,
              textFormat: { bold: true },
              horizontalAlignment: 'CENTER'
            }
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat.bold,horizontalAlignment)'
        }
      },
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: rowCount,
            startColumnIndex: 0,
            endColumnIndex: colCount
          },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE'
            }
          },
          fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)'
        }
      }
    ];

    for (let i = 0; i < totalUsers; i++) {
      const statusRowIndex = 1 + i * 2;
      const projectRowIndex = statusRowIndex + 1;

      requests.push({
        mergeCells: {
          range: {
            sheetId,
            startRowIndex: statusRowIndex,
            endRowIndex: projectRowIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: 1
          },
          mergeType: 'MERGE_ALL'
        }
      });

      requests.push({
        mergeCells: {
          range: {
            sheetId,
            startRowIndex: statusRowIndex,
            endRowIndex: projectRowIndex + 1,
            startColumnIndex: 1,
            endColumnIndex: 2
          },
          mergeType: 'MERGE_ALL'
        }
      });

      requests.push({
        mergeCells: {
          range: {
            sheetId,
            startRowIndex: statusRowIndex,
            endRowIndex: projectRowIndex + 1,
            startColumnIndex: 2,
            endColumnIndex: 3
          },
          mergeType: 'MERGE_ALL'
        }
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = monthStart.set({ day });
      const weekday = date.weekday;
      if (weekday !== 6 && weekday !== 7) continue;
      const col = 3 + (day - 1);

      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: col,
            endColumnIndex: col + 1
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: WEEKEND_HEADER_BG,
              textFormat: { bold: true }
            }
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat.bold)'
        }
      });

      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: rowCount,
            startColumnIndex: col,
            endColumnIndex: col + 1
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: WEEKEND_BODY_BG
            }
          },
          fields: 'userEnteredFormat.backgroundColor'
        }
      });
    }

    requests.push({
      updateBorders: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: rowCount,
          startColumnIndex: 0,
          endColumnIndex: colCount
        },
        top: { style: 'NONE' },
        bottom: { style: 'NONE' },
        left: { style: 'NONE' },
        right: { style: 'NONE' },
        innerHorizontal: { style: 'NONE' },
        innerVertical: { style: 'NONE' }
      }
    });

    for (let i = 0; i < totalUsers; i++) {
      const statusRowIndex = 1 + i * 2;
      const projectRowIndex = statusRowIndex + 1;
      requests.push({
        updateBorders: {
          range: {
            sheetId,
            startRowIndex: statusRowIndex,
            endRowIndex: projectRowIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: colCount
          },
          bottom: {
            style: 'SOLID_MEDIUM',
            width: 2,
            color: { red: 0, green: 0, blue: 0 }
          }
        }
      });
    }

    for (let i = 0; i < totalUsers; i++) {
      const projectRowIndex = 2 + i * 2;
      for (let day = 1; day <= daysInMonth; day++) {
        const col = 3 + (day - 1);
        const cellValue = values[projectRowIndex]?.[col] || '';
        if (!cellValue) continue;

        const firstProject = cellValue
          .split(input.projectDelimiter)
          .map((part) => part.trim())
          .filter(Boolean)[0];
        if (!firstProject) continue;

        const color = this.projectColor(firstProject);
        requests.push({
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: projectRowIndex,
              endRowIndex: projectRowIndex + 1,
              startColumnIndex: col,
              endColumnIndex: col + 1
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: color,
                textFormat: { bold: true }
              }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat.bold)'
          }
        });
      }
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests }
    });
  }

  private projectColor(projectName: string): Rgb {
    let hash = 0;
    for (let i = 0; i < projectName.length; i++) {
      hash = (hash * 31 + projectName.charCodeAt(i)) >>> 0;
    }
    return PROJECT_PALETTE[hash % PROJECT_PALETTE.length];
  }

  private async getSheetsClient(): Promise<sheets_v4.Sheets | null> {
    if (!env.SPREADSHEET_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
      return null;
    }

    const auth = new google.auth.JWT({
      email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    await auth.authorize();
    return google.sheets({ version: 'v4', auth });
  }

  private async ensureTabExists(
    sheets: sheets_v4.Sheets,
    spreadsheetId: string,
    tabName: string
  ): Promise<number> {
    const metadata = await sheets.spreadsheets.get({ spreadsheetId });
    const existing = metadata.data.sheets || [];
    const found = existing.find((sheet) => sheet.properties?.title === tabName);
    if (found?.properties?.sheetId != null) return found.properties.sheetId;

    const created = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: tabName
              }
            }
          }
        ]
      }
    });

    const reply = created.data.replies?.[0]?.addSheet?.properties?.sheetId;
    if (reply == null) {
      throw new Error(`Failed to create sheet tab: ${tabName}`);
    }
    return reply;
  }
}
