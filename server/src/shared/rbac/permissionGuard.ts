import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError.js';
import { getPermissionCodes } from './permissionCache.js';
import { resolvePermission } from './permissionRegistry.js';

/**
 * Chốt chặn quyền DUY NHẤT của toàn app. Cắm MỘT lần trong `app.ts`, sau
 * `requireAuth` và trước mọi router.
 *
 * **Không có `if (user.role === 'ADMIN')` hay `if (perms.includes(...))` trong
 * bất kỳ controller hay service nào.** Toàn bộ quyết định cho/chặn nằm ở file
 * này. Quyền rải rác trong service thì không ai trả lời được "ai gọi được
 * endpoint X" mà không đọc hết code; tập trung một chỗ thì câu trả lời là
 * `permissionRegistry` — và bảng đó đọc được trong 30 giây.
 *
 * Đúng bốn việc, không hơn: resolve luật → luật mở thì cho qua → lấy tập quyền
 * từ cache → có mã thì `next()`, không thì 403.
 *
 * Guard KHÔNG đọc body, KHÔNG đọc DB nghiệp vụ, KHÔNG biết `:id` là của ai.
 * Nó chỉ nhìn method + path + tập quyền. Chuyện "hàng này của ai" là của
 * ownership ở tầng repository, và hai lớp đó trực giao — xem SPEC §5.
 */
export async function permissionGuard(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const { matched, permission } = resolvePermission(req.method, req.path);

  // Mặc định TỪ CHỐI: path dưới /api không khớp luật nào → 403, không phải cho
  // qua. Quên khai route mới vào registry thành lỗi ỒN ÀO ngay lần test đầu,
  // thay vì một route dữ liệu sức khỏe im lặng không được bảo vệ (SPEC §6.4).
  if (!matched) {
    next(AppError.forbidden('Endpoint chưa được khai trong bảng phân quyền'));
    return;
  }

  // Luật mở: trả sớm, không đụng cache và không cần `req.user`.
  if (permission === null) {
    next();
    return;
  }

  // Tới đây chắc chắn đã qua `requireAuth`, nhưng vẫn kiểm thay vì `!`: nếu ai
  // đó cắm guard nhầm chỗ (trước requireAuth) thì phải 401 chứ không phải nổ.
  const userId = req.user?.id;
  if (!userId) {
    next(AppError.unauthorized());
    return;
  }

  const codes = await getPermissionCodes(userId);
  if (codes.has(permission)) {
    next();
    return;
  }

  // `message` ĐƯỢC PHÉP nêu mã quyền còn thiếu — giúp gỡ lỗi, không lộ gì về
  // dữ liệu người khác. Nó KHÔNG được nêu vai trò nào có quyền đó, cũng không
  // nêu tài nguyên có tồn tại hay không (chuyện đó thuộc ownership → 404).
  next(AppError.forbidden(`Vai trò hiện tại không có quyền ${permission}`));
}
