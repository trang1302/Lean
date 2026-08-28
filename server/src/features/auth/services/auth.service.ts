import { AppError } from '../../../shared/errors/AppError.js';
import { dummyHash, hashPassword, verifyPassword } from '../../../shared/security/password.js';
import type { LoginInput, RegisterInput } from '../dtos/auth.request.js';
import { toPublicUser, type PublicUser } from '../dtos/auth.response.js';
import * as loginAttemptRepository from '../repositories/loginAttempt.repository.js';
import * as sessionRepository from '../repositories/session.repository.js';
import * as userRepository from '../repositories/user.repository.js';

/**
 * Ngưỡng chống brute-force. Ba hằng ở một chỗ để đổi chính sách chỉ sửa một nơi.
 *
 * 5 lần / 15 phút là giá trị plan đề xuất và CHƯA được chủ repo chốt cứng
 * (docs/superpowers/plans/2026-08-10-auth-backend-giai-doan-a.md §Task 11).
 * Cửa sổ trượt: hết 15 phút không thất bại thêm là tự mở lại, không có job nào
 * phải chạy để "mở khóa".
 */
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

/** Vai trò của mọi tài khoản tự đăng ký. Nâng vai trò chỉ qua PUT /users/:id/role. */
const DEFAULT_ROLE_CODE = 'USER';

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

  // Vai trò gán CỨNG phía server, KHÔNG đọc từ request body — nếu không thì ai
  // cũng tự đăng ký làm SYSTEM_ADMIN. `null` khi chưa chạy seed: tài khoản vẫn
  // tạo được nhưng có tập quyền rỗng, tức fail closed chứ không fail open.
  const roleId = await userRepository.findRoleIdByCode(DEFAULT_ROLE_CODE);

  const user = await userRepository.createUser({
    email: input.email,
    passwordHash: await hashPassword(input.password),
    displayName: input.displayName ?? null,
    roleId,
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
export async function authenticate(input: LoginInput, ip: string): Promise<PublicUser> {
  const since = new Date(Date.now() - WINDOW_MS);
  const { byEmail, byIp } = await loginAttemptRepository.countRecentFailures(
    input.email,
    ip,
    since,
  );

  // Kiểm ngưỡng TRƯỚC Argon2, và trước cả `findUserByEmail`.
  //
  // Trước Argon2 vì verify tốn hàng chục ms CPU CÓ CHỦ ĐÍCH — để kẻ tấn công
  // kích hoạt nó không giới hạn là biến chống-brute-force thành lỗ DoS.
  //
  // Trước `findUserByEmail` vì nhánh này phải chạy giống hệt nhau bất kể email
  // có tồn tại hay không. Chỉ khóa email có thật thì chính mã 429 trở thành
  // oracle đoán tài khoản — đúng thứ mà `invalidCredentials()` dựng lên để tránh.
  //
  // KHÔNG ghi `recordAttempt` ở nhánh này: ghi cả lần bị chặn nghĩa là mỗi lần
  // gõ thêm lại đẩy mốc thời gian mới nhất lên, cửa sổ tự gia hạn vô tận và
  // người dùng thật không bao giờ hết bị khóa.
  if (byEmail >= MAX_FAILURES || byIp >= MAX_FAILURES) {
    throw AppError.tooManyAttempts();
  }

  const user = await userRepository.findUserByEmail(input.email);

  if (!user) {
    await verifyPassword(await dummyHash(), input.password);
    await loginAttemptRepository.recordAttempt(input.email, ip, false);
    throw AppError.invalidCredentials();
  }

  if (!(await verifyPassword(user.passwordHash, input.password))) {
    await loginAttemptRepository.recordAttempt(input.email, ip, false);
    throw AppError.invalidCredentials();
  }

  // Ngoại lệ CÓ CHỦ ĐÍCH so với §7.3: chỉ trả ACCOUNT_DISABLED SAU khi mật
  // khẩu đã đúng. Lúc đó người gọi đã chứng minh họ sở hữu tài khoản nên không
  // rò gì thêm — và im lặng ở đây khiến người dùng thật thử lại mật khẩu đúng
  // mãi không hiểu vì sao.
  if (user.status !== 'active') {
    // Ghi nhận là THẤT BẠI: tài khoản bị khóa vẫn là một đường để dò mật khẩu.
    await loginAttemptRepository.recordAttempt(input.email, ip, false);
    throw AppError.accountDisabled();
  }

  await loginAttemptRepository.recordAttempt(input.email, ip, true);
  await loginAttemptRepository.clearFailuresForEmail(input.email);
  await userRepository.updateLastLoginAt(user.id, new Date());
  return toPublicUser(user);
}

/**
 * Đá mọi phiên KHÁC của user — một tài khoản, một phiên sống tại một thời điểm.
 *
 * Tương đương BackChannelConcurrentSessionControl của upip nhưng rẻ hơn nhiều
 * bậc: một tiến trình, một bảng, không Kafka, không registry. Chỉ hiện thực
 * được nhờ cột `userId` nằm sẵn trong bảng `Session` — đó là lý do một session
 * store lưu phiên dưới dạng blob không khóa được theo user bị loại từ đầu.
 */
/**
 * Thu hồi MỌI phiên của một user — dùng khi khóa/xóa tài khoản và khi reset
 * mật khẩu. Khác `revokeOtherSessions` ở chỗ không chừa phiên nào: người bị
 * khóa phải mất quyền truy cập ngay, kể cả tab đang mở.
 */
export async function revokeAllSessions(userId: string): Promise<number> {
  return sessionRepository.deleteSessionsByUserId(userId);
}

export async function revokeOtherSessions(
  userId: string,
  keepSessionId: string,
): Promise<number> {
  return sessionRepository.deleteSessionsByUserIdExcept(userId, keepSessionId);
}

export async function findPublicUserById(id: string): Promise<PublicUser | null> {
  const user = await userRepository.findUserById(id);
  return user ? toPublicUser(user) : null;
}
