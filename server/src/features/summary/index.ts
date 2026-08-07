import { Router } from 'express';
import { getSummary } from './controllers/summary.controller.js';

// `app.ts` cắm router này ở prefix `/api/summary` — tên export phải giữ nguyên.
export const summaryRouter = Router();

summaryRouter.get('/', getSummary);
