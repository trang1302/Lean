import { Router } from 'express';
import { usersController } from './controllers/users.controller.js';

// `app.ts` cắm ở prefix `/api/users` — path bên trong controller là tương đối.
export const usersRouter = Router();
usersRouter.use(usersController);
