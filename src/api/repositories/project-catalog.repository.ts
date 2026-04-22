import { prisma } from '../../config/prisma';
import type { ProjectCatalogRecord } from './models';

function mapProject(row: {
  id: bigint;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ProjectCatalogRecord {
  return {
    id: Number(row.id),
    name: row.name,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export class ProjectCatalogRepository {
  async listProjects(): Promise<ProjectCatalogRecord[]> {
    const rows = await prisma.project.findMany({
      orderBy: [{ name: 'asc' }]
    });

    return rows.map((row) => mapProject(row));
  }

  async listActiveProjects(): Promise<ProjectCatalogRecord[]> {
    const rows = await prisma.project.findMany({
      where: { active: true },
      orderBy: [{ name: 'asc' }]
    });

    return rows.map((row) => mapProject(row));
  }

  async createProject(name: string, active: boolean): Promise<ProjectCatalogRecord> {
    const row = await prisma.project.create({
      data: {
        name,
        active
      }
    });

    return mapProject(row);
  }

  async updateProject(id: number, input: { name?: string; active?: boolean }): Promise<ProjectCatalogRecord | null> {
    if (input.name === undefined && input.active === undefined) return null;

    const existing = await prisma.project.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return null;

    const updated = await prisma.project.update({
      where: { id: BigInt(id) },
      data: {
        name: input.name ?? existing.name,
        active: input.active ?? existing.active,
        updatedAt: new Date()
      }
    });

    return mapProject(updated);
  }

  async deleteProject(id: number): Promise<boolean> {
    const deleted = await prisma.project.deleteMany({ where: { id: BigInt(id) } });
    return deleted.count > 0;
  }
}
