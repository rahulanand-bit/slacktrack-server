import { z } from 'zod';
import { AdminAuthRepository } from '../api/repositories/admin-auth.repository';
import type { AdminRole } from '../api/repositories/models';
import { logger } from '../config/logger';
import { prisma } from '../config/prisma';
import { hashPassword } from '../utils/password';

const inputSchema = z.object({
  ADMIN_SEED_EMAIL: z.string().email(),
  ADMIN_SEED_PASSWORD: z.string().min(8),
  ADMIN_SEED_ROLE: z.enum(['admin', 'hr', 'manager', 'analytics']).default('admin')
});

async function seedAdmin(): Promise<void> {
  const parsed = inputSchema.parse(process.env);
  const repository = new AdminAuthRepository();
  const passwordHash = await hashPassword(parsed.ADMIN_SEED_PASSWORD);

  const user = await repository.createAdminUser({
    email: parsed.ADMIN_SEED_EMAIL.toLowerCase(),
    passwordHash,
    role: parsed.ADMIN_SEED_ROLE as AdminRole
  });

  logger.info({ id: user.id, email: user.email, role: user.role }, 'Admin user seeded');
}

void seedAdmin()
  .catch((error: Error) => {
    logger.error({ error: error.message }, 'Failed to seed admin user');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
