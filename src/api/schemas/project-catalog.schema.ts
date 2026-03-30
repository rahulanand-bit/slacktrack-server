import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().trim().min(1),
  active: z.boolean().optional()
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    active: z.boolean().optional()
  })
  .refine((value) => value.name !== undefined || value.active !== undefined, {
    message: 'At least one field (name or active) must be provided'
  });
