import express from 'express';
import { bodyLogsRouter } from './features/bodyLogs/index.js';
import { mealsRouter } from './features/meals/index.js';
import { goalRouter } from './features/goal/index.js';
import { summaryRouter } from './features/summary/index.js';
import { remindersRouter } from './features/reminders/index.js';
import { errorHandler, notFoundHandler } from './shared/errors/errorHandler.js';

/**
 * Lắp express app nhưng KHÔNG gọi `listen()` — `server.ts` lo việc đó.
 * Tách ra để supertest dựng app trong test mà không chiếm cổng.
 */
export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/body-logs', bodyLogsRouter);
  app.use('/api/meals', mealsRouter);
  app.use('/api/goal', goalRouter);
  app.use('/api/summary', summaryRouter);
  app.use('/api/reminders', remindersRouter);

  // Thứ tự bắt buộc: notFound trước, errorHandler cuối cùng.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
