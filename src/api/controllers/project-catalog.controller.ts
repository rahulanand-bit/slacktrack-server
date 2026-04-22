import type { Request, Response } from 'express';
import { createProjectSchema, updateProjectSchema } from '../schemas/project-catalog.schema';
import type { ProjectCatalogService } from '../services/project-catalog.service';

export class ProjectCatalogController {
  constructor(private readonly projectCatalogService: ProjectCatalogService) {}

  async listProjects(_req: Request, res: Response): Promise<void> {
    const projects = await this.projectCatalogService.listProjects();
    res.status(200).json({ ok: true, data: projects });
  }

  async createProject(req: Request, res: Response): Promise<void> {
    const input = createProjectSchema.parse(req.body);
    const project = await this.projectCatalogService.createProject(input);
    if (!project) {
      res.status(409).json({ ok: false, error: 'Project name already exists' });
      return;
    }
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

  async deleteProject(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.id);
    if (!Number.isFinite(projectId) || projectId <= 0) {
      res.status(400).json({ ok: false, error: 'Invalid project id' });
      return;
    }

    const deleted = await this.projectCatalogService.deleteProject(projectId);
    if (!deleted) {
      res.status(404).json({ ok: false, error: 'Project not found' });
      return;
    }

    res.status(200).json({ ok: true });
  }
}
