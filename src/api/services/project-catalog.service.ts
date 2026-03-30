import { env } from '../../config/env';
import { logger } from '../../config/logger';
import type { Redis } from 'ioredis';
import type { ProjectCatalogRecord } from '../repositories/models';
import type { ProjectCatalogRepository } from '../repositories/project-catalog.repository';

const ACTIVE_PROJECTS_CACHE_KEY = 'projects:active:list:v1';

export class ProjectCatalogService {
  constructor(
    private readonly projectCatalogRepository: ProjectCatalogRepository,
    private readonly redis: Redis
  ) {}

  async listProjects(): Promise<ProjectCatalogRecord[]> {
    return this.projectCatalogRepository.listProjects();
  }

  async createProject(input: { name: string; active?: boolean }): Promise<ProjectCatalogRecord> {
    const project = await this.projectCatalogRepository.createProject(input.name.trim(), input.active ?? true);
    await this.invalidateActiveProjectsCache();
    return project;
  }

  async updateProject(
    id: number,
    input: { name?: string; active?: boolean }
  ): Promise<ProjectCatalogRecord | null> {
    const updated = await this.projectCatalogRepository.updateProject(id, {
      name: input.name?.trim(),
      active: input.active
    });

    if (updated) {
      await this.invalidateActiveProjectsCache();
    }

    return updated;
  }

  async deleteProject(id: number): Promise<boolean> {
    const deleted = await this.projectCatalogRepository.deleteProject(id);
    if (deleted) {
      await this.invalidateActiveProjectsCache();
    }

    return deleted;
  }

  async listActiveProjectNames(): Promise<string[]> {
    try {
      const cached = await this.redis.get(ACTIVE_PROJECTS_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached) as string[];
      }
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : 'unknown' },
        'Failed to read active projects from cache'
      );
    }

    const fromDb = await this.projectCatalogRepository.listActiveProjects();
    const names = fromDb.map((project) => project.name);

    try {
      await this.redis.setex(
        ACTIVE_PROJECTS_CACHE_KEY,
        env.PROJECT_CATALOG_CACHE_TTL_SECONDS,
        JSON.stringify(names)
      );
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : 'unknown' },
        'Failed to write active projects to cache'
      );
    }

    return names;
  }

  private async invalidateActiveProjectsCache(): Promise<void> {
    try {
      await this.redis.del(ACTIVE_PROJECTS_CACHE_KEY);
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : 'unknown' },
        'Failed to invalidate active projects cache'
      );
    }
  }
}
