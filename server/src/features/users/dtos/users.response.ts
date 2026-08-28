/**
 * Hình dạng tài khoản khi ra khỏi API quản trị.
 *
 * KHÔNG có `passwordHash`, và không bao giờ được có. Chọn trường tường minh là
 * cách duy nhất khiến việc thêm một cột nhạy cảm vào `User` sau này không tự
 * động rò ra API.
 *
 * Cũng KHÔNG có dữ liệu sức khỏe: `user:view` là quyền xem TÀI KHOẢN. `ADMIN`
 * thấy email và vai trò của mọi người, không thấy cân nặng của ai
 * (rbac/SPEC.md §5).
 */
export interface UserRoleView {
  id: string;
  code: string;
  name: string;
}

export interface UserView {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  role: UserRoleView | null;
  lastLoginAt: string | null;
  createdAt: string;
}

interface UserRow {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  role: UserRoleView | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export function toUserView(row: UserRow): UserView {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    status: row.status,
    role: row.role,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}
