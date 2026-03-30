import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8)
});

export const createAdminUserSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'hr', 'manager', 'analytics'])
});
