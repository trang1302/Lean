import type { UserRecord } from '../repositories/user.repository.js';

export interface PublicRole {
  id: string;
  code: string;
  name: string;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  /** `null` = chưa được cấp vai trò. FE hiện màn "chưa được cấp quyền". */
  role: PublicRole | null;
}

export interface SessionResponse {
  user: PublicUser;
  /**
   * Mã quyền của phiên hiện tại. FE gate màn hình bằng ĐÂY, không bằng
   * `user.role.code` — gate theo role code là nhân bản ma trận quyền ra FE,
   * và hai bản sẽ lệch nhau ngay lần đầu sửa ma trận (rbac/SPEC.md §12).
   *
   * Ẩn nút KHÔNG phải bảo mật: server vẫn chặn bằng `permissionGuard`.
   */
  permissions: string[];
  expiresAt: string | null;
}

/**
 * Chọn trường TƯỜNG MINH, không trả nguyên row Prisma (auth/SPEC.md §4).
 * Đây là cách duy nhất khiến việc thêm một cột nhạy cảm vào `User` sau này
 * không tự động rò ra API.
 *
 * `permissions` nằm trong CHÍNH response này, không có endpoint /api/auth/me
 * riêng (rbac/SPEC.md:660) — một nguồn sự thật, một lời gọi.
 */
export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    role: user.role,
  };
}

/**
 * Nhận `PublicUser`, KHÔNG nhận `UserRecord`. Hàm này không được có cơ hội
 * nhìn thấy `passwordHash`: kiểu đầu vào là lớp bảo vệ, không chỉ là chú thích.
 */
export function toSessionResponse(
  user: PublicUser,
  permissions: string[],
  expiresAt: Date | null,
): SessionResponse {
  return {
    user,
    // Sắp xếp để response ổn định giữa các lần gọi — tập quyền đến từ một
    // `Set`, vốn không hứa thứ tự.
    permissions: [...permissions].sort(),
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
  };
}
