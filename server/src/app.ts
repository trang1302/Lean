import cookieParser from 'cookie-parser';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { env } from './config/env.js';
import { authRouter } from './features/auth/index.js';
import { requireAuth } from './features/auth/middleware/requireAuth.js';
import { PrismaSessionStore } from './features/auth/prismaSessionStore.js';
import { bodyLogsRouter } from './features/bodyLogs/index.js';
import { mealsRouter } from './features/meals/index.js';
import { goalRouter } from './features/goal/index.js';
import { summaryRouter } from './features/summary/index.js';
import { remindersRouter } from './features/reminders/index.js';
import { errorHandler, notFoundHandler } from './shared/errors/errorHandler.js';
import { permissionGuard } from './shared/rbac/permissionGuard.js';
import { csrfProtection } from './shared/security/csrf.js';

/**
 * CSP mặc định của helmet CHẶN Vite dev server — Vite tiêm script inline và mở
 * WebSocket cho HMR. Nới THEO MÔI TRƯỜNG, không tắt hẳn CSP để cho dev chạy;
 * đó là cách một cấu hình lỏng vô tình lên production (auth/SPEC.md:604).
 */
function helmetOptions(nodeEnv: string) {
  if (nodeEnv === 'production') return undefined; // mặc định của helmet
  return {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", 'ws:', 'wss:'],
      },
    },
  };
}

/**
 * Lắp express app nhưng KHÔNG gọi `listen()` — `server.ts` lo việc đó.
 * Tách ra để supertest dựng app trong test mà không chiếm cổng.
 *
 * THỨ TỰ MIDDLEWARE Ở ĐÂY LÀ BẢO MẬT, KHÔNG PHẢI THẨM MỸ (auth/SPEC.md:198):
 *   helmet → json → cookie-parser → session → csrf → /api/health →
 *   /api/auth/* → requireAuth → 5 router dữ liệu → notFound → errorHandler
 *
 * `cookie-parser` phải đứng trước `csrfProtection`: csrf-csrf@4 đọc cookie qua
 * `req.cookies`, thiếu nó là MỌI request ghi trả 403 kể cả khi token đúng.
 * `session` phải đứng trước `csrfProtection` vì `getSessionIdentifier` đọc
 * `req.session.userId`.
 */
export function createApp(): express.Express {
  const app = express();

  // `req.ip` (dùng để đếm thất bại đăng nhập theo nguồn) chỉ đúng khi cấu hình
  // này khớp hạ tầng thật. Bật nhầm khi KHÔNG có proxy là để client tự khai IP
  // qua `X-Forwarded-For` và né được bộ đếm; không bật khi CÓ proxy là mọi
  // request trông như đến từ một IP duy nhất và khóa nhầm TOÀN BỘ người dùng.
  // Localhost (dev/test) không có proxy nào nên để nguyên mặc định.
  if (env.NODE_ENV === 'production') app.set('trust proxy', 1);

  app.use(helmet(helmetOptions(env.NODE_ENV)));
  app.use(express.json());
  app.use(cookieParser());

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

  app.use(csrfProtection);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);

  // Chốt chặn: mọi thứ DƯỚI dòng này cần phiên. Đặt requireAuth MỘT lần ở đây,
  // không rải vào từng feature — mặc định ĐÓNG, mở bằng whitelist tường minh
  // (là những gì nằm TRÊN dòng này). Thêm một router mới ở dưới thì nó được
  // bảo vệ sẵn, không có bước "nhớ khóa route mới" nào để quên.
  app.use(requireAuth);

  // Chốt chặn thứ HAI, cắm MỘT lần, ngay sau requireAuth và trước mọi router.
  // requireAuth trả lời "anh là ai"; permissionGuard trả lời "vai trò của anh
  // có được gọi endpoint này không". Không feature nào tự cắm guard riêng, và
  // không controller/service nào được chứa `if (role === ...)`.
  //
  // Mặc định TỪ CHỐI: route không khai trong permissionRegistry → 403.
  //
  // Cắm ở '/api' chứ không ở cấp app: `req.path` bên trong middleware khi đó
  // đã bỏ tiền tố, khớp đúng định nghĩa "path dưới /api" của registry. Cắm ở
  // cấp app thì mọi path ngoài /api cũng rơi vào nhánh mặc-định-từ-chối và trả
  // 403 thay cho 404 của notFoundHandler.
  app.use('/api', permissionGuard);

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
