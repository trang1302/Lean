import { Router, type Request, type Response } from 'express';
import { AppError } from '../../../shared/errors/AppError.js';
import { getPermissionCodes } from '../../../shared/rbac/permissionCache.js';
import { generateCsrfToken } from '../../../shared/security/csrf.js';
import { loginSchema, registerSchema } from '../dtos/auth.request.js';
import { toSessionResponse } from '../dtos/auth.response.js';
import * as authService from '../services/auth.service.js';

export const authController = Router();

/**
 * Lớp DUY NHẤT của app được chạm `req.session`.
 *
 * API phiên của express-session là CALLBACK, không phải Promise. Quên await là
 * tạo race: response trả về trước khi phiên kịp ghi xuống store, request kế
 * tiếp thấy như chưa đăng nhập — lỗi chập chờn rất khó lần ra
 * (auth/SPEC.md:190).
 */
function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Web gọi endpoint này lúc khởi động và gắn token vào mọi request GHI.
 *
 * GET nên KHÔNG cần token — nếu không thì không có đường nào lấy token đầu tiên.
 *
 * Phải gọi LẠI sau khi đăng nhập: định danh buộc token đổi từ '' sang userId
 * (xem `shared/security/csrf.ts`), nên token lấy lúc còn vô danh hết hiệu lực
 * ngay khi phiên bắt đầu.
 */
authController.get('/csrf', (req: Request, res: Response) => {
  res.json({ csrfToken: generateCsrfToken(req, res) });
});

/** Đăng ký mở công khai. Vai trò gán cứng phía server ở giai đoạn B — KHÔNG đọc từ body. */
authController.post('/register', async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body ?? {});
  res.status(201).json({ user: await authService.registerUser(input) });
});

authController.post('/login', async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body ?? {});
  // `req.ip` chỉ đúng khi `trust proxy` khớp hạ tầng thật — xem app.ts.
  const user = await authService.authenticate(input, req.ip ?? 'unknown');

  // Xoay session id TRƯỚC khi ghi userId. Không xoay thì id trước và sau đăng
  // nhập là một, và kẻ tấn công ép nạn nhân dùng một id hắn biết rồi dùng lại
  // chính id đó sau khi nạn nhân đăng nhập (auth/SPEC.md §7.4).
  await regenerateSession(req);
  req.session.userId = user.id;
  await saveSession(req);

  // Đá mọi phiên KHÁC của user này. Chạy SAU `regenerate` + `save`, nếu không
  // nó xóa luôn phiên vừa tạo (lúc đó `req.sessionID` chưa có hàng trong DB để
  // mà loại trừ).
  await authService.revokeOtherSessions(user.id, req.sessionID);

  // Tập quyền đọc qua cache, KHÔNG nhét vào phiên: đổi vai trò phải có hiệu
  // lực ở request kế tiếp, không đợi người dùng đăng nhập lại.
  const permissions = await getPermissionCodes(user.id);

  res.json(toSessionResponse(user, [...permissions], req.session.cookie.expires ?? null));
});

/** Idempotent: gọi khi không có phiên vẫn 204. */
authController.post('/logout', async (req: Request, res: Response) => {
  if (req.session?.userId) await destroySession(req);
  res.clearCookie('lean.sid');
  res.status(204).end();
});

/**
 * Route này KHÔNG đi qua requireAuth (nó nằm trước requireAuth trong chuỗi
 * app.ts), nên tự kiểm phiên.
 */
authController.get('/session', async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) throw AppError.unauthorized();

  const user = await authService.findPublicUserById(userId);
  if (!user) {
    // Phiên trỏ vào user đã bị xóa: hủy phiên rồi trả 401, đừng trả 500.
    await destroySession(req);
    throw AppError.unauthorized();
  }

  const permissions = await getPermissionCodes(user.id);
  res.json(toSessionResponse(user, [...permissions], req.session.cookie.expires ?? null));
});
