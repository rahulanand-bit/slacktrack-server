import { ProjectCatalogRepository } from '../api/repositories/project-catalog.repository';
import { logger } from '../config/logger';
import { prisma } from '../config/prisma';
import { projectCatalogSeed } from '../config/project-catalog.seed';

function resolveSeedProjects(): string[] {
  return projectCatalogSeed;
}

async function seedProjects(): Promise<void> {
  const repository = new ProjectCatalogRepository();
  const projects = resolveSeedProjects();

  for (const projectName of projects) {
    await repository.createProject(projectName, true);
  }

  logger.info({ count: projects.length }, 'Seeded projects catalog');
}

void seedProjects()
  .catch((error: Error) => {
    logger.error({ error: error.message }, 'Failed to seed projects catalog');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
