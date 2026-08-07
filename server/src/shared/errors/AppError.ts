export type AppErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'INTERNAL_ERROR';

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
}
