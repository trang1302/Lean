import { AppError } from '../../../shared/errors/AppError.js';
import { dummyHash, hashPassword, verifyPassword } from '../../../shared/security/password.js';
import type { LoginInput, RegisterInput } from '../dtos/auth.request.js';
import { toPublicUser, type PublicUser } from '../dtos/auth.response.js';
import * as userRepository from '../repositories/user.repository.js';

// Tầng này KHÔNG biết `req`, KHÔNG biết Prisma. Nhận dữ liệu đã validate,
// trả PublicUser hoặc ném AppError.

export async function registerUser(input: RegisterInput): Promise<PublicUser> {
  if (await userRepository.emailExists(input.email)) {
    // 400 + fields thay vì thêm mã CONFLICT mới: giữ union AppErrorCode nhỏ và
    // giữ đúng hình dạng lỗi 5 feature đang dùng.
    //
    // Đây là chỗ đăng ký mở tự nó tiết lộ email nào có tài khoản. Không bịt
    // được khi chưa có xác thực email — nợ đã ghi ở design doc §7.
    throw AppError.validation('Dữ liệu gửi lên không hợp lệ', [
      { path: 'email', message: 'Email này đã được dùng' },
    ]);
  }

  const user = await userRepository.createUser({
    email: input.email,
    passwordHash: await hashPassword(input.password),
    displayName: input.displayName ?? null,
  });

  return toPublicUser(user);
}

/**
 * Trả user khi mật khẩu đúng, ném AppError khi không.
 *
 * Hai nhánh phải mất thời gian TƯƠNG ĐƯƠNG: email không tồn tại vẫn chạy một
 * lần verify Argon2 với hash giả. Thoát sớm ở nhánh đó tạo chênh lệch thời gian
 * đo được, đủ để dò email nào có tài khoản (auth/SPEC.md §7.3).
 */
export async function authenticate(input: LoginInput): Promise<PublicUser> {
  const user = await userRepository.findUserByEmail(input.email);

  if (!user) {
    await verifyPassword(await dummyHash(), input.password);
    throw AppError.invalidCredentials();
  }

  if (!(await verifyPassword(user.passwordHash, input.password))) {
    throw AppError.invalidCredentials();
  }

  // Ngoại lệ CÓ CHỦ ĐÍCH so với §7.3: chỉ trả ACCOUNT_DISABLED SAU khi mật
  // khẩu đã đúng. Lúc đó người gọi đã chứng minh họ sở hữu tài khoản nên không
  // rò gì thêm — và im lặng ở đây khiến người dùng thật thử lại mật khẩu đúng
  // mãi không hiểu vì sao.
  if (user.status !== 'active') {
    throw AppError.accountDisabled();
  }

  await userRepository.updateLastLoginAt(user.id, new Date());
  return toPublicUser(user);
}

export async function findPublicUserById(id: string): Promise<PublicUser | null> {
  const user = await userRepository.findUserById(id);
  return user ? toPublicUser(user) : null;
}
