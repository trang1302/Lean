import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      /**
       * Do `requireAuth` gắn. Giai đoạn B thêm `roleId` vào đây — khi đó
       * `permissionGuard` đọc nó để tra tập quyền.
       */
      user?: { id: string };
    }
  }
}
