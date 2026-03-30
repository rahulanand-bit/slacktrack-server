import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { requirePermission } from '../middlewares/admin-rbac.middleware';
import type { ProjectCatalogController } from '../controllers/project-catalog.controller';

export function createProjectRouter(controller: ProjectCatalogController): Router {
  const router = Router();

  router.get('/projects', requirePermission('projects:read'), asyncHandler(controller.listProjects.bind(controller)));
  router.post('/projects', requirePermission('projects:write'), asyncHandler(controller.createProject.bind(controller)));
  router.patch(
    '/projects/:id',
    requirePermission('projects:write'),
    asyncHandler(controller.updateProject.bind(controller))
  );

  return router;
}
