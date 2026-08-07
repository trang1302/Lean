import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, type FieldError } from './AppError.js';

function toFieldErrors(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Middleware lỗi cuối chuỗi. Express 5 tự chuyển lỗi từ handler async tới đây —
 * KHÔNG cần `express-async-errors`, và đừng bọc try/catch chỉ để nuốt lỗi.
 *
 * Hình dạng response chốt ở Global Constraints của plan:
 *   400 → { error: { code: 'VALIDATION_ERROR', message, fields: [...] } }
 *   404 → { error: { code: 'NOT_FOUND', message } }
 *   500 → { error: { code: 'INTERNAL_ERROR', message } }
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu gửi lên không hợp lệ',
        fields: toFieldErrors(err),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.fields ? { fields: err.fields } : {}),
      },
    });
    return;
  }

  // Lỗi ngoài dự kiến: log nguyên văn ra server, trả client thông điệp chung.
  console.error('[unhandled]', err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Lỗi không mong đợi phía máy chủ' },
  });
}

/** Bắt mọi route không khớp. Đặt SAU tất cả router, TRƯỚC errorHandler. */
export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound('Không tìm thấy endpoint'));
}
