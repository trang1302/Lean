import express from 'express';
import session from 'express-session';
import { env } from './config/env.js';
import { authRouter } from './features/auth/index.js';
import { PrismaSessionStore } from './features/auth/prismaSessionStore.js';
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

  app.use(
    session({
      name: 'lean.sid',
      secret: env.SESSION_SECRET,
      store: new PrismaSessionStore(),
      resave: false,
      // BẮT BUỘC false: phiên vô danh không ghi được vào bảng Session vì cột
      // userId có khóa ngoại tới User. Đặt true là ném lỗi FK ở mọi request
      // của khách chưa đăng nhập.
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      },
    }),
  );

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);

  // CHƯA mắc `requireAuth` trước năm router dưới đây — đó là Task 6, và cần
  // helper đăng nhập của Task 10 trước, nếu không 250 test hiện có đỏ hàng loạt.
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
