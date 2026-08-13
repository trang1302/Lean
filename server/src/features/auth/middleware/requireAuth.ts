import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../../shared/errors/AppError.js';

/**
 * Chốt chặn phiên. Mắc MỘT lần trong app.ts trước năm router dữ liệu, không
 * rải vào từng feature (auth/SPEC.md:217): mặc định là ĐÓNG, chỉ mở ra bằng
 * whitelist tường minh. Cách ngược lại — mặc định mở, tự nhớ khóa từng route —
 * chắc chắn sẽ có ngày quên một route.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const userId = req.session?.userId;
  if (!userId) {
    next(AppError.unauthorized());
    return;
  }
  req.user = { id: userId };
  next();
}
