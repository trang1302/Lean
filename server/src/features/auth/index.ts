import { Router } from 'express';
import { authController } from './controllers/auth.controller.js';

// `app.ts` cắm router này ở prefix `/api/auth` — path bên trong là tương đối.
export const authRouter = Router();

authRouter.use('/', authController);

export { requireAuth } from './middleware/requireAuth.js';
