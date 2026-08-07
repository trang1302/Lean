import { Router } from 'express';
import { goalController } from './controllers/goal.controller.js';

// Router được `app.ts` cắm sẵn ở prefix `/api/goal` — path bên trong là tương đối.
export const goalRouter = Router();

goalRouter.use('/', goalController);
