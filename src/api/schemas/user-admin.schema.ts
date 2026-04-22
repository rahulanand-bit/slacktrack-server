import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().trim().min(1),
  slackId: z.string().trim().min(1),
  email: z.string().trim().email().nullable().optional(),
  isMessageEnabled: z.boolean().optional()
});

export const slackIdParamSchema = z.object({
  slackUserId: z.string().trim().min(1)
});

export const bulkCreateUserSchema = z.object({
  users: z.array(createUserSchema).min(1).max(500)
});

export const listUsersQuerySchema = z.object({
  includeInactive: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((value) => value === 'true')
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().email().nullable().optional(),
    isMessageEnabled: z.boolean().optional()
  })
  .refine((value) => value.name !== undefined || value.email !== undefined || value.isMessageEnabled !== undefined, {
    message: 'At least one field is required'
  });

export const messagingToggleSchema = z.object({
  isMessageEnabled: z.boolean()
});
