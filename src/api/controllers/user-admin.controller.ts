import type { Request, Response } from 'express';
import { z } from 'zod';
import type { UserAdminService } from '../services/user-admin.service';

const createUserSchema = z.object({
  name: z.string().trim().min(1),
  slackId: z.string().trim().min(1),
  email: z.string().trim().email().nullable().optional(),
  isMessageEnabled: z.boolean().optional()
});

const slackIdParamSchema = z.object({
  slackUserId: z.string().trim().min(1)
});

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
