export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_DISABLED'
  | 'CSRF_ERROR'
  | 'TOO_MANY_ATTEMPTS';

export interface FieldError {
  path: string;
  message: string;
}

/** Lỗi có chủ đích, mang sẵn status và mã để errorHandler dịch thẳng ra response. */
export class AppError extends Error {
  readonly status: number;
  readonly code: AppErrorCode;
  readonly fields?: FieldError[];

  constructor(status: number, code: AppErrorCode, message: string, fields?: FieldError[]) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (fields) this.fields = fields;
  }

  static notFound(message: string): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static validation(message: string, fields: FieldError[]): AppError {
    return new AppError(400, 'VALIDATION_ERROR', message, fields);
  }

  static unauthorized(message = 'Cần đăng nhập'): AppError {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message: string): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }

  /**
   * Sai email và sai mật khẩu dùng CHUNG factory này — cùng mã, cùng message.
   * Tách ra hai câu khác nhau biến form đăng nhập thành công cụ liệt kê tài
   * khoản (auth/SPEC.md §7.3). Đừng thêm tham số `message`.
   */
  static invalidCredentials(): AppError {
    return new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');
  }

  static accountDisabled(): AppError {
    return new AppError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị khóa');
  }

  static csrfFailed(): AppError {
    return new AppError(403, 'CSRF_ERROR', 'CSRF token thiếu hoặc không hợp lệ');
  }

  static tooManyAttempts(): AppError {
    return new AppError(429, 'TOO_MANY_ATTEMPTS', 'Thử quá nhiều lần. Đợi ít phút rồi thử lại');
  }
}
