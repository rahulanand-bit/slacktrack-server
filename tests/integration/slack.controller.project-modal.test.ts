import crypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { SlackController } from '../../src/api/controllers/slack.controller';
import { env } from '../../src/config/env';

function createResponseMock() {
  const payload: { status?: number; body?: unknown } = {};
  return {
    res: {
      status(code: number) {
        payload.status = code;
        return this;
      },
      json(body: unknown) {
        payload.body = body;
        return this;
      },
      send(body: unknown) {
        payload.body = body;
        return this;
      }
    },
    payload
  };
}

describe('SlackController project modal flow', () => {
  it('queues project update on modal submit', async () => {
    env.ENABLE_PROJECT_TRACKING = true;
    env.PROJECT_SPLIT_MODAL_ENABLED = true;

    const attendanceService = {
      enqueueAttendanceUpdate: vi.fn(async () => undefined),
      enqueueProjectUpdate: vi.fn(async () => undefined),
      getTodayYmd: vi.fn(() => '2026-03-15'),
      getProjectsForDate: vi.fn(async () => ['Alpha'])
    };

    const chatService = {
      enqueueChatParse: vi.fn(async () => undefined)
    };

    const slackApiService = {
      openProjectModal: vi.fn(async () => undefined)
    };

    const projectCatalogService = {
      listActiveProjectNames: vi.fn(async () => ['Alpha', 'Beta'])
    };

    const controller = new SlackController(
      attendanceService as never,
      chatService as never,
      projectCatalogService as never,
      slackApiService as never
    );

    const modalPayload = {
      type: 'view_submission',
      team: { id: env.SLACK_TEAM_ID || 'T1' },
      user: { id: 'U1' },
      view: {
        callback_id: 'project_modal_submit',
        private_metadata: JSON.stringify({ slackUserId: 'U1', dateYmd: '2026-03-15' }),
        state: {
          values: {
            projects_text_block: {
              projects_text: {
                type: 'plain_text_input',
                value: 'Alpha, Beta'
              }
            }
          }
        }
      }
    };

    const rawBody = `payload=${encodeURIComponent(JSON.stringify(modalPayload))}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = env.SLACK_SIGNING_SECRET
      ? `v0=${crypto
          .createHmac('sha256', env.SLACK_SIGNING_SECRET)
          .update(`v0:${timestamp}:${rawBody}`, 'utf8')
          .digest('hex')}`
      : undefined;

    const request = {
      rawBody,
      body: { payload: JSON.stringify(modalPayload) },
      header: (name: string) => {
        if (name.toLowerCase() === 'x-slack-signature') return signature;
        if (name.toLowerCase() === 'x-slack-request-timestamp') return timestamp;
        return undefined;
      }
    };

    const { res, payload } = createResponseMock();
    await controller.postSlack(request as never, res as never);

    expect(attendanceService.enqueueProjectUpdate).toHaveBeenCalledTimes(1);
    expect(payload.status).toBe(200);
  });
});
