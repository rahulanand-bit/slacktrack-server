import { env } from '../../config/env';
import { logger } from '../../config/logger';

type SlackResponse = {
  ok: boolean;
  error?: string;
  channel?: { id?: string };
  ts?: string;
};

type SlackBlock = Record<string, unknown>;

export class SlackApiService {
  private readonly token = env.SLACK_BOT_TOKEN;

  async openIm(userId: string): Promise<string | null> {
    const response = await this.apiCall('conversations.open', { users: userId });
    return response.channel?.id || null;
  }

  async sendText(channelId: string, text: string): Promise<void> {
    await this.apiCall('chat.postMessage', { channel: channelId, text });
  }

  async sendAttendanceActions(userId: string): Promise<void> {
    const channelId = await this.openIm(userId);
    if (!channelId) throw new Error('Could not open DM channel');

    const blocks = this.buildAttendanceBlocks();

    await this.apiCall('chat.postMessage', {
      channel: channelId,
      text: 'Please update your attendance for today.',
      blocks
    });
  }

  async notifyAttendanceFailure(userId: string, attendanceValue: string, reason: string): Promise<void> {
    const channelId = await this.openIm(userId);
    if (!channelId) {
      logger.warn({ userId }, 'Could not open DM channel for attendance failure');
      return;
    }
    await this.sendText(
      channelId,
      `Attendance update failed for *${attendanceValue}*. Please try again. Error: ${reason}`
    );
  }

  async sendProjectReminder(userId: string, dateYmd: string): Promise<void> {
    const channelId = await this.openIm(userId);
    if (!channelId) return;
    await this.apiCall('chat.postMessage', {
      channel: channelId,
      text: `Please update your projects for ${dateYmd}.`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Attendance is marked, but projects are missing for *${dateYmd}*.`
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              action_id: 'set_projects',
              text: { type: 'plain_text', text: 'Set Projects (Optional)' }
            }
          ]
        }
      ]
    });
  }

  async sendClarification(channelId: string, text: string): Promise<void> {
    await this.sendText(channelId, text);
  }

  async updateAttendanceMessageState(params: {
    channelId?: string;
    messageTs?: string;
    selectedActionId?: string;
    failed?: boolean;
  }): Promise<void> {
    if (!params.channelId || !params.messageTs) return;

    const blocks = this.buildAttendanceBlocks({
      selectedActionId: params.selectedActionId,
      failed: params.failed
    });

    await this.apiCall('chat.update', {
      channel: params.channelId,
      ts: params.messageTs,
      text: params.failed ? 'Attendance update failed. Please retry.' : 'Attendance noted.',
      blocks
    });
  }

  async openProjectModal(params: {
    triggerId: string;
    slackUserId: string;
    dateYmd: string;
    existingProjects: string[];
    projectOptions: string[];
  }): Promise<void> {
    const optionsSource =
      params.projectOptions.length > 0
        ? params.projectOptions
        : (env.PROJECT_OPTIONS || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);

    const initial = params.existingProjects.join(', ');
    const hintSource = optionsSource.length > 0 ? `e.g. ${optionsSource.slice(0, 3).join(', ')}` : 'max 3';
    const hint = hintSource.length > 80 ? `${hintSource.slice(0, 77)}...` : hintSource;
    const projectInputBlock: SlackBlock = {
      type: 'input',
      block_id: 'projects_text_block',
      optional: !env.PROJECT_TRACKING_REQUIRED,
      element: {
        type: 'plain_text_input',
        action_id: 'projects_text',
        initial_value: initial,
        placeholder: {
          type: 'plain_text',
          text: `Comma separated projects (${hint})`
        }
      },
      label: { type: 'plain_text', text: 'Projects (max 3)' }
    };

    const view = {
      type: 'modal',
      callback_id: 'project_modal_submit',
      private_metadata: JSON.stringify({
        slackUserId: params.slackUserId,
        dateYmd: params.dateYmd
      }),
      title: { type: 'plain_text', text: 'Set Projects' },
      submit: { type: 'plain_text', text: 'Save' },
      close: { type: 'plain_text', text: 'Cancel' },
      blocks: [projectInputBlock]
    };

    await this.apiCall('views.open', {
      trigger_id: params.triggerId,
      view
    });
  }

  private async apiCall(method: string, body: Record<string, unknown>): Promise<SlackResponse> {
    if (!this.token) {
      logger.warn({ method }, 'Skipping Slack API call because SLACK_BOT_TOKEN is missing');
      return { ok: false, error: 'missing_token' };
    }

    const response = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const payload = (await response.json()) as SlackResponse;
    if (!payload.ok) {
      throw new Error(`Slack ${method} failed: ${payload.error || 'unknown'}`);
    }
    return payload;
  }

  private buildAttendanceBlocks(params?: {
    selectedActionId?: string;
    failed?: boolean;
  }): SlackBlock[] {
    const selected = params?.selectedActionId;
    const failed = params?.failed;

    const buttonStyle = (actionId: string): string | undefined => {
      if (!selected || failed) {
        return undefined;
      }

      if (selected === actionId) {
        if (actionId === 'leave_full' || actionId === 'leave_half') return 'danger';
        return 'primary';
      }

      return undefined;
    };

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: failed
            ? 'Attendance update failed. Please retry.'
            : 'Please update your attendance for today.'
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            action_id: 'wfo',
            text: { type: 'plain_text', text: 'WFO' },
            ...(buttonStyle('wfo') ? { style: buttonStyle('wfo') } : {})
          },
          {
            type: 'button',
            action_id: 'wfh',
            text: { type: 'plain_text', text: 'WFH' },
            ...(buttonStyle('wfh') ? { style: buttonStyle('wfh') } : {})
          },
          {
            type: 'button',
            action_id: 'leave_full',
            text: { type: 'plain_text', text: 'Leave (-1)' },
            ...(buttonStyle('leave_full') ? { style: buttonStyle('leave_full') } : {})
          },
          {
            type: 'button',
            action_id: 'leave_half',
            text: { type: 'plain_text', text: 'Half Day (-0.5)' },
            ...(buttonStyle('leave_half') ? { style: buttonStyle('leave_half') } : {})
          }
        ]
      },
      ...(env.ENABLE_PROJECT_TRACKING && env.PROJECT_SPLIT_MODAL_ENABLED
        ? [
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  action_id: 'set_projects',
                  text: { type: 'plain_text', text: 'Set Projects (Optional)' }
                }
              ]
            }
          ]
        : [])
    ];
  }
}
