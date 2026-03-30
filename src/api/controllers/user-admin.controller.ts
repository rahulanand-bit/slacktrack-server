import type { Request, Response } from 'express';
import {
  bulkCreateUserSchema,
  createUserSchema,
  messagingToggleSchema,
  slackIdParamSchema,
  updateUserSchema
} from '../schemas/user-admin.schema';
import type { UserAdminService } from '../services/user-admin.service';

export class UserAdminController {
  constructor(private readonly userAdminService: UserAdminService) {}

  async listUsers(_req: Request, res: Response): Promise<void> {
    const users = await this.userAdminService.listUsers();
    res.status(200).json({ ok: true, data: users });
  }

  async createUser(req: Request, res: Response): Promise<void> {
    const input = createUserSchema.parse(req.body);
    const user = await this.userAdminService.createUser(input);
    res.status(201).json({ ok: true, data: user });
  }

  async createUsersBulk(req: Request, res: Response): Promise<void> {
    const input = bulkCreateUserSchema.parse(req.body);
    const users = await this.userAdminService.createUsersBulk(input.users);
    res.status(201).json({ ok: true, data: users });
  }

  async updateUser(req: Request, res: Response): Promise<void> {
    const { slackUserId } = slackIdParamSchema.parse(req.params);
    const input = updateUserSchema.parse(req.body);
    const user = await this.userAdminService.updateUser(slackUserId, input);
    if (!user) {
      res.status(404).json({ ok: false, error: 'User not found' });
      return;
    }

    res.status(200).json({ ok: true, data: user });
  }

  async setMessagingEnabled(req: Request, res: Response): Promise<void> {
    const { slackUserId } = slackIdParamSchema.parse(req.params);
    const { isMessageEnabled } = messagingToggleSchema.parse(req.body);
    const user = await this.userAdminService.setMessagingEnabled(slackUserId, isMessageEnabled);
    if (!user) {
      res.status(404).json({ ok: false, error: 'User not found' });
      return;
    }

    res.status(200).json({ ok: true, data: user });
  }

  async deactivateMessaging(req: Request, res: Response): Promise<void> {
    const { slackUserId } = slackIdParamSchema.parse(req.params);
    const user = await this.userAdminService.deactivateMessaging(slackUserId);
    if (!user) {
      res.status(404).json({ ok: false, error: 'User not found' });
      return;
    }

    res.status(200).json({ ok: true, data: user });
  }
}
