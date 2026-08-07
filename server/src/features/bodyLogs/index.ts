import { Router } from 'express';
import { registerBodyLogsRoutes } from './controllers/bodyLogs.controller.js';

// Router được `app.ts` cắm sẵn ở prefix `/api/body-logs`. Giữ nguyên tên export:
// 4 feature khác cũng theo khuôn này, đổi tên ở đây là sửa `app.ts`.
export const bodyLogsRouter = Router();

registerBodyLogsRoutes(bodyLogsRouter);
