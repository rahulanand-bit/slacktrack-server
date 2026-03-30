import type { Request, Response } from 'express';
import { z } from 'zod';
import type { AuthService } from '../services/auth.service';

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8)
});

const createAdminUserSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'hr', 'manager'])
});

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  async createAdminUser(req: Request, res: Response): Promise<void> {
    const input = createAdminUserSchema.parse(req.body);
    const user = await this.authService.createAdminUser(input);
    res.status(201).json({ ok: true, data: user });
  }

  async login(req: Request, res: Response): Promise<void> {
    const input = loginSchema.parse(req.body);
    const session = await this.authService.login(input.email, input.password);
    if (!session) {
      res.status(401).json({ ok: false, error: 'Invalid email or password' });
      return;
    }

    res.status(200).json({
      ok: true,
      data: {
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
        user: session.user
      }
    });
  }

  async logout(req: Request, res: Response): Promise<void> {
    const accessToken = req.adminAuth?.token;
    if (!accessToken) {
      res.status(401).json({ ok: false, error: 'Missing admin token' });
      return;
    }

    await this.authService.logout(accessToken);
    res.status(200).json({ ok: true });
  }

  async me(req: Request, res: Response): Promise<void> {
    if (!req.adminAuth) {
      res.status(401).json({ ok: false, error: 'Missing admin auth context' });
      return;
    }

    res.status(200).json({
      ok: true,
      data: {
        actorId: req.adminAuth.actorId,
        email: req.adminAuth.email || null,
        role: req.adminAuth.role,
        permissions: req.adminAuth.permissions
      }
    });
  }
}
