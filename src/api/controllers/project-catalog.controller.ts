import type { Request, Response } from 'express';
import { z } from 'zod';
import type { ProjectCatalogService } from '../services/project-catalog.service';

const createProjectSchema = z.object({
  name: z.string().trim().min(1),
  active: z.boolean().optional()
});

const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    active: z.boolean().optional()
  })
  .refine((value) => value.name !== undefined || value.active !== undefined, {
    message: 'At least one field (name or active) must be provided'
  });

export class ProjectCatalogController {
  constructor(private readonly projectCatalogService: ProjectCatalogService) {}

  async listProjects(_req: Request, res: Response): Promise<void> {
    const projects = await this.projectCatalogService.listProjects();
    res.status(200).json({ ok: true, data: projects });
  }

  async createProject(req: Request, res: Response): Promise<void> {
    const input = createProjectSchema.parse(req.body);
    const project = await this.projectCatalogService.createProject(input);
    res.status(201).json({ ok: true, data: project });
  }

  async updateProject(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.id);
    if (!Number.isFinite(projectId) || projectId <= 0) {
      res.status(400).json({ ok: false, error: 'Invalid project id' });
      return;
    }

    const input = updateProjectSchema.parse(req.body);
    const project = await this.projectCatalogService.updateProject(projectId, input);
    if (!project) {
      res.status(404).json({ ok: false, error: 'Project not found' });
      return;
    }

    res.status(200).json({ ok: true, data: project });
  }
}
