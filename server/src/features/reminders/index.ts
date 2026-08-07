import { Router } from 'express';
import { remindersController } from './controllers/reminders.controller.js';

// `app.ts` cắm router này ở prefix `/api/reminders` — path bên trong controller
// là tương đối. Tên export giữ nguyên, đừng đổi.
export const remindersRouter = Router();
remindersRouter.use(remindersController);

// Scheduler không tự khởi động khi import: `server.ts` gọi hàm này sau khi
// listen. Import module mà có tác dụng phụ sẽ bật cron trong cả test.
export { startReminderScheduler, stopReminderScheduler } from './services/reminders.scheduler.js';
