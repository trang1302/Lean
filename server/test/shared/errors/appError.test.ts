import { describe, it, expect } from 'vitest';
import { AppError } from '../../../src/shared/errors/AppError.js';

describe('AppError — mã lỗi của auth', () => {
  it('unauthorized → 401 UNAUTHORIZED', () => {
    const err = AppError.unauthorized('Cần đăng nhập');
    expect(err.status).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('forbidden → 403 FORBIDDEN', () => {
    expect(AppError.forbidden('x').status).toBe(403);
    expect(AppError.forbidden('x').code).toBe('FORBIDDEN');
  });

  it('invalidCredentials → 401, message KHÔNG tiết lộ email có tồn tại hay không', () => {
    // auth/SPEC.md §7.3: sai email và sai mật khẩu phải cùng mã VÀ cùng message.
    // Test này khóa message lại để không ai "cải thiện" nó thành hai câu khác nhau.
    const err = AppError.invalidCredentials();
    expect(err.status).toBe(401);
    expect(err.code).toBe('INVALID_CREDENTIALS');
    expect(err.message).toBe('Email hoặc mật khẩu không đúng');
  });

  it('accountDisabled → 403 ACCOUNT_DISABLED', () => {
    expect(AppError.accountDisabled().status).toBe(403);
    expect(AppError.accountDisabled().code).toBe('ACCOUNT_DISABLED');
  });

  it('csrfFailed → 403 CSRF_ERROR', () => {
    expect(AppError.csrfFailed().status).toBe(403);
    expect(AppError.csrfFailed().code).toBe('CSRF_ERROR');
  });

  it('tooManyAttempts → 429 TOO_MANY_ATTEMPTS', () => {
    expect(AppError.tooManyAttempts().status).toBe(429);
    expect(AppError.tooManyAttempts().code).toBe('TOO_MANY_ATTEMPTS');
  });
});
