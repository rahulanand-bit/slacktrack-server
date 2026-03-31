import type { Request, Response } from 'express';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AttendanceService } from '../services/attendance.service';
import type { ChatService } from '../services/chat.service';
import type { ProjectCatalogService } from '../services/project-catalog.service';
import type { SlackApiService } from '../services/slack-api.service';
import { parseSlackInteractivePayload, verifySlackSignature } from '../../utils/slack';

type RawRequest = Request & { rawBody?: string };

export class SlackController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly chatService: ChatService,
    private readonly projectCatalogService: ProjectCatalogService,
    private readonly slackApiService: SlackApiService
  ) {}

  async postSlack(req: RawRequest, res: Response): Promise<void> {
    const rawBody = req.rawBody || '';
    const signature = req.header('x-slack-signature');
    const timestamp = req.header('x-slack-request-timestamp');
    const valid = verifySlackSignature({
      signingSecret: env.SLACK_SIGNING_SECRET,
      rawBody,
      signature,
      timestamp
    });
    if (!valid) {
      res.status(401).json({ ok: false, error: 'Invalid Slack signature' });
      return;
    }

    if (rawBody.trim().startsWith('{')) {
      await this.handleEventPayload(req, res);
      return;
    }

    await this.handleInteractivePayload(req, res);
  }

  private async handleEventPayload(req: RawRequest, res: Response): Promise<void> {
    const body = req.body as Record<string, unknown>;

    if (body.type === 'url_verification' && typeof body.challenge === 'string') {
      res.status(200).send(body.challenge);
      return;
    }

    if (body.type !== 'event_callback') {
      res.status(200).send('ok');
      return;
    }

    const teamId = typeof body.team_id === 'string' ? body.team_id : '';
    if (env.SLACK_TEAM_ID && teamId && teamId !== env.SLACK_TEAM_ID) {
      res.status(200).send('ok');
      return;
    }

    const event = (body.event || {}) as Record<string, unknown>;
    const type = String(event.type || '');
    const channelType = String(event.channel_type || '');
    const user = String(event.user || '');
    const channel = String(event.channel || '');
    const text = String(event.text || '');
    const ts = String(event.ts || Date.now());
    const isBot = Boolean(event.bot_id) || Boolean(event.subtype);

    if (type === 'message' && channelType === 'im' && !isBot && user && channel && text) {
      await this.chatService.enqueueChatParse({
        slackUserId: user,
        channelId: channel,
        text,
        eventTs: ts
      });
    }

    res.status(200).send('ok');
  }

  private async handleInteractivePayload(req: RawRequest, res: Response): Promise<void> {
    const rawBody = req.rawBody || '';
    const parsedFromRaw = parseSlackInteractivePayload(rawBody);
    let parsedFromBody: object | null = null;
    try {
      if (typeof req.body.payload === 'string') {
        parsedFromBody = JSON.parse(req.body.payload);
      } else if (req.body.payload && typeof req.body.payload === 'object') {
        parsedFromBody = req.body.payload as object;
      }
    } catch {
      parsedFromBody = null;
    }

    const payload = parsedFromRaw || parsedFromBody;
    if (!payload) {
      res.status(400).json({ ok: false, error: 'Invalid interactive payload' });
      return;
    }

    const typedPayload = payload as {
      type?: string;
      team?: { id?: string };
      user?: { id?: string };
      actions?: Array<{ action_id?: string }>;
      action_ts?: string;
      trigger_id?: string;
      channel?: { id?: string };
      container?: { channel_id?: string; message_ts?: string };
      message?: {
        ts?: string;
        blocks?: Array<{
          elements?: Array<{ action_id?: string; style?: string }>;
        }>;
      };
      view?: {
        callback_id?: string;
        private_metadata?: string;
        state?: {
          values?: Record<string, Record<string, Record<string, unknown>>>;
        };
      };
    };

    logger.info(
      {
        payloadType: typedPayload.type,
        teamId: typedPayload.team?.id,
        userId: typedPayload.user?.id,
        actionId: typedPayload.actions?.[0]?.action_id,
        callbackId: typedPayload.view?.callback_id,
        hasViewState: Boolean(typedPayload.view?.state?.values)
      },
      'Received Slack interactive payload'
    );

    if (env.SLACK_TEAM_ID && typedPayload.team?.id && typedPayload.team.id !== env.SLACK_TEAM_ID) {
      res.status(200).json({ ok: false, error: 'Team mismatch' });
      return;
    }

    if (typedPayload.type === 'view_submission' && typedPayload.view?.callback_id === 'project_modal_submit') {
      logger.info(
        {
          userId: typedPayload.user?.id,
          callbackId: typedPayload.view?.callback_id,
          blockIds: Object.keys(typedPayload.view?.state?.values || {})
        },
        'Handling Slack project modal submission'
      );
      await this.handleProjectModalSubmission(typedPayload, res);
      return;
    }

    const userId = typedPayload.user?.id;
    const actionId = typedPayload.actions?.[0]?.action_id;
    if (actionId === 'set_projects') {
      await this.handleProjectModalOpen(typedPayload, res);
      return;
    }

    const resolvedAttendance = AttendanceService.mapActionToAttendance(actionId);
    const messageState = this.parseMessageState(typedPayload.message);

    if (!userId || !resolvedAttendance) {
      res.status(200).json({ response_type: 'ephemeral', text: 'Invalid action payload.' });
      return;
    }

    await this.attendanceService.enqueueAttendanceUpdate({
      slackUserId: userId,
      attendanceValue: resolvedAttendance as 'WFO' | 'WFH' | '-1' | '-0.5',
      actionTs: typedPayload.action_ts || String(Date.now()),
      sourceChannelId: typedPayload.channel?.id || typedPayload.container?.channel_id,
      sourceMessageTs: typedPayload.container?.message_ts || typedPayload.message?.ts,
      projectSelected: messageState.projectSelected
    });

    logger.info({ userId, actionId, resolvedAttendance }, 'Interactive attendance queued');
    res.status(200).json({
      response_type: 'ephemeral',
      replace_original: false,
      text: 'Attendance noted. Processing update.'
    });
  }

  private async handleProjectModalOpen(
    payload: {
      user?: { id?: string };
      trigger_id?: string;
      channel?: { id?: string };
      container?: { channel_id?: string; message_ts?: string };
      message?: {
        ts?: string;
        blocks?: Array<{
          elements?: Array<{ action_id?: string; style?: string }>;
        }>;
      };
    },
    res: Response
  ): Promise<void> {
    if (!env.ENABLE_PROJECT_TRACKING || !env.PROJECT_SPLIT_MODAL_ENABLED) {
      res.status(200).json({
        response_type: 'ephemeral',
        text: 'Project tracking is currently disabled.'
      });
      return;
    }

    const userId = payload.user?.id;
    const triggerId = payload.trigger_id;
    if (!userId || !triggerId) {
      res.status(200).json({ response_type: 'ephemeral', text: 'Project modal could not be opened.' });
      return;
    }

    const dateYmd = this.attendanceService.getTodayYmd();
    const existingProjects = await this.attendanceService.getProjectsForDate(userId, dateYmd);
    const projectOptions = await this.projectCatalogService.listActiveProjectNames();
    const messageState = this.parseMessageState(payload.message);
    await this.slackApiService.openProjectModal({
      triggerId,
      slackUserId: userId,
      dateYmd,
      existingProjects,
      projectOptions,
      sourceChannelId: payload.channel?.id || payload.container?.channel_id,
      sourceMessageTs: payload.container?.message_ts || payload.message?.ts,
      selectedAttendanceActionId: messageState.selectedAttendanceActionId
    });

    res.status(200).json({ ok: true });
  }

  private async handleProjectModalSubmission(
    payload: {
      user?: { id?: string };
      view?: {
        private_metadata?: string;
        state?: {
          values?: Record<string, Record<string, Record<string, unknown>>>;
        };
      };
    },
    res: Response
  ): Promise<void> {
    if (!env.ENABLE_PROJECT_TRACKING || !env.PROJECT_SPLIT_MODAL_ENABLED) {
      res.status(200).json({ response_action: 'clear' });
      return;
    }

    const metadata = this.parsePrivateMetadata(payload.view?.private_metadata);
    const userId = metadata.slackUserId || payload.user?.id;
    const dateYmd = metadata.dateYmd || this.attendanceService.getTodayYmd();

    if (!userId) {
      res.status(200).json({ response_action: 'clear' });
      return;
    }

    const projects = this.extractProjectsFromViewState(payload.view?.state?.values);
    logger.info(
      {
        userId,
        dateYmd,
        extractedProjects: projects
      },
      'Parsed projects from Slack modal submission'
    );

    try {
      const normalized = AttendanceService.validateProjects(projects, env.MAX_PROJECTS_PER_DAY);
      logger.info(
        {
          userId,
          dateYmd,
          normalizedProjects: normalized
        },
        'Validated projects from Slack modal submission'
      );
      await this.attendanceService.enqueueProjectUpdate({
        slackUserId: userId,
        dateYmd,
        projects: normalized,
        submissionTs: String(Date.now()),
        sourceChannelId: metadata.sourceChannelId,
        sourceMessageTs: metadata.sourceMessageTs,
        selectedAttendanceActionId: metadata.selectedAttendanceActionId
      });
      logger.info({ userId, dateYmd }, 'Enqueued project update from Slack modal');
      res.status(200).json({ response_action: 'clear' });
    } catch (err) {
      const errorMessage = String(err instanceof Error ? err.message : 'Invalid project input');
      logger.warn(
        {
          userId,
          dateYmd,
          extractedProjects: projects,
          errorMessage
        },
        'Project modal submission validation failed'
      );
      const blocks = this.extractProjectErrorBlocks(payload.view?.state?.values);
      const errors: Record<string, string> = {};
      for (const blockId of blocks) {
        errors[blockId] = errorMessage;
      }
      if (Object.keys(errors).length === 0) {
        errors.projects_text_block = errorMessage;
      }

      res.status(200).json({
        response_action: 'errors',
        errors
      });
    }
  }

  private parsePrivateMetadata(rawMetadata?: string): {
    slackUserId?: string;
    dateYmd?: string;
    sourceChannelId?: string;
    sourceMessageTs?: string;
    selectedAttendanceActionId?: 'wfo' | 'wfh' | 'leave_full' | 'leave_half';
  } {
    if (!rawMetadata) return {};
    try {
      const parsed = JSON.parse(rawMetadata) as {
        slackUserId?: string;
        dateYmd?: string;
        sourceChannelId?: string;
        sourceMessageTs?: string;
        selectedAttendanceActionId?: 'wfo' | 'wfh' | 'leave_full' | 'leave_half';
      };
      return {
        slackUserId: parsed.slackUserId,
        dateYmd: parsed.dateYmd,
        sourceChannelId: parsed.sourceChannelId,
        sourceMessageTs: parsed.sourceMessageTs,
        selectedAttendanceActionId: parsed.selectedAttendanceActionId
      };
    } catch {
      return {};
    }
  }

  private extractProjectsFromViewState(
    values: Record<string, Record<string, Record<string, unknown>>> | undefined
  ): string[] {
    if (!values) return [];

    const selectedProjects: string[] = [];
    const entries = Object.values(values);
    for (const entry of entries) {
      const action = Object.values(entry)[0];
      if (!action) continue;

      const multiSelected = action.selected_options;
      if (Array.isArray(multiSelected)) {
        for (const option of multiSelected) {
          const text = (option as { text?: { text?: string } }).text?.text;
          if (typeof text === 'string' && text.trim()) {
            if (text === 'No active projects configured') {
              continue;
            }
            selectedProjects.push(text);
            continue;
          }

          const value = (option as { value?: string }).value;
          if (value === 'project_none') {
            continue;
          }
          if (value) selectedProjects.push(value);
        }
      }

      const value = action.value;
      if (typeof value === 'string' && value.trim()) {
        selectedProjects.push(
          ...value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        );
      }
    }

    return Array.from(new Set(selectedProjects));
  }

  private extractProjectErrorBlocks(
    values: Record<string, Record<string, Record<string, unknown>>> | undefined
  ): string[] {
    if (!values) return [];
    return Object.keys(values).filter(
      (blockId) => blockId === 'projects_text_block' || blockId === 'projects_select_block'
    );
  }

  private parseMessageState(message?: {
    blocks?: Array<{
      elements?: Array<{ action_id?: string; style?: string }>;
    }>;
  }): {
    selectedAttendanceActionId?: 'wfo' | 'wfh' | 'leave_full' | 'leave_half';
    projectSelected: boolean;
  } {
    const state: {
      selectedAttendanceActionId?: 'wfo' | 'wfh' | 'leave_full' | 'leave_half';
      projectSelected: boolean;
    } = { projectSelected: false };

    const blocks = message?.blocks || [];
    for (const block of blocks) {
      const elements = block.elements || [];
      for (const element of elements) {
        if (element.action_id === 'set_projects' && element.style === 'primary') {
          state.projectSelected = true;
        }

        if (
          (element.action_id === 'wfo' ||
            element.action_id === 'wfh' ||
            element.action_id === 'leave_full' ||
            element.action_id === 'leave_half') &&
          (element.style === 'primary' || element.style === 'danger')
        ) {
          state.selectedAttendanceActionId = element.action_id;
        }
      }
    }

    return state;
  }
}
