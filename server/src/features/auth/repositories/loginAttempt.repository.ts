import { prisma } from '../../../lib/db.js';

/**
 * Chỗ DUY NHẤT chạm bảng `LoginAttempt`.
 *
 * `emailKey` là email ĐÃ CHUẨN HÓA (trim + lowercase). Việc chuẩn hóa xảy ra ở
 * `emailSchema` trong `dtos/auth.request.ts`, nên mọi giá trị tới đây đã đúng
 * dạng — đừng chuẩn hóa lại ở đây, hai nơi cùng làm là hai nơi cùng có thể lệch.
 * Không chuẩn hóa thì "USER@Lean.Local" là một khóa đếm khác và kẻ tấn công
 * nhân N lần ngưỡng chỉ bằng cách đổi hoa thường.
 */

export async function recordAttempt(
  emailKey: string,
  ip: string,
  succeeded: boolean,
): Promise<void> {
  await prisma.loginAttempt.create({ data: { emailKey, ip, succeeded } });
}

/**
 * Đếm theo HAI CHIỀU ĐỘC LẬP:
 *   - `emailKey`: chặn dò mật khẩu vào một tài khoản cụ thể;
 *   - `ip`:       chặn quét nhiều tài khoản từ một nguồn (password spraying),
 *                 thứ mà đếm theo email hoàn toàn không thấy.
 */
export async function countRecentFailures(
  emailKey: string,
  ip: string,
  since: Date,
): Promise<{ byEmail: number; byIp: number }> {
  const [byEmail, byIp] = await Promise.all([
    prisma.loginAttempt.count({
      where: { emailKey, succeeded: false, createdAt: { gte: since } },
    }),
    prisma.loginAttempt.count({ where: { ip, succeeded: false, createdAt: { gte: since } } }),
  ]);
  return { byEmail, byIp };
}

export async function clearFailuresForEmail(emailKey: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { emailKey, succeeded: false } });
}

/** Bảng tăng vô hạn nếu không dọn hàng cũ hơn cửa sổ — `server.ts` gọi định kỳ. */
export async function deleteAttemptsBefore(cutoff: Date): Promise<number> {
  const result = await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return result.count;
}
