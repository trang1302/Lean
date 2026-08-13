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
 * `csrf-csrf` ném `HttpError` riêng của nó, KHÔNG phải AppError — không nhận
 * diện thì nó rơi vào nhánh 500 ở dưới và client thấy sai mã (auth/SPEC.md:320).
 *
 * `'EBADCSRFTOKEN'` là giá trị của bản đang cài (csrf-csrf@4.0.3, xác nhận trong
 * `dist/`). Thư viện cho ghi đè qua `errorConfig.code` — nếu ai đó đặt giá trị
 * khác ở `app.ts` thì phải sửa cả hàm này, nên đừng đặt.
 */
function isCsrfError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  return (err as { code?: unknown }).code === 'EBADCSRFTOKEN';
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

  if (isCsrfError(err)) {
    const appError = AppError.csrfFailed();
    res.status(appError.status).json({
      error: { code: appError.code, message: appError.message },
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
