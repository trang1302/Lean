import type { UserRecord } from '../repositories/user.repository.js';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
}

export interface SessionResponse {
  user: PublicUser;
  expiresAt: string | null;
}

/**
 * Chọn trường TƯỜNG MINH, không trả nguyên row Prisma (auth/SPEC.md §4).
 * Đây là cách duy nhất khiến việc thêm một cột nhạy cảm vào `User` sau này
 * không tự động rò ra API.
 *
 * Giai đoạn B mở rộng SessionResponse thêm `permissions: string[]` — sửa ở
 * đây, KHÔNG tạo endpoint /api/auth/me riêng (rbac/SPEC.md:660).
 */
export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
  };
}

/**
 * Nhận `PublicUser`, KHÔNG nhận `UserRecord`. Hàm này không được có cơ hội
 * nhìn thấy `passwordHash`: kiểu đầu vào là lớp bảo vệ, không chỉ là chú thích.
 */
export function toSessionResponse(user: PublicUser, expiresAt: Date | null): SessionResponse {
  return { user, expiresAt: expiresAt ? expiresAt.toISOString() : null };
}
