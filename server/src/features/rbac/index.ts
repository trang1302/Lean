import { Router } from 'express';
import { permissionsController, rolesController } from './controllers/rbac.controller.js';

export const permissionsRouter = Router();
permissionsRouter.use(permissionsController);

export const rolesRouter = Router();
rolesRouter.use(rolesController);
