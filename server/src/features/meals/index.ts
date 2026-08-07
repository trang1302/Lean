import { Router } from 'express';
import { registerMealsRoutes } from './controllers/meals.controller.js';

// `app.ts` cắm router này ở prefix `/api/meals` — giữ nguyên tên export.
export const mealsRouter = Router();

registerMealsRoutes(mealsRouter);
