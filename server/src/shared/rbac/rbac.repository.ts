import { prisma } from '../../lib/db.js';

/**
 * Chỗ DUY NHẤT của tầng RBAC dùng chung chạm `prisma`.
 *
 * Feature `rbac` (API quản trị, giai đoạn C) có repository riêng của nó; file
 * này chỉ phục vụ `permissionGuard` — thứ chạy trên MỌI request nên phải mỏng.
 */

/**
 * Tập mã quyền của một user, suy ra qua `User.roleId → RolePermission → Permission`.
 *
 * `roleId = null` → mảng rỗng → mọi route cần quyền đều 403 (fail closed). Đó
 * là hành vi đúng: tài khoản chưa được cấp vai trò vẫn đăng nhập được để thấy
 * màn "chưa được cấp quyền", nhưng không làm được gì.
 */
export async function findPermissionCodesByUserId(userId: string): Promise<string[]> {
  const rows = await prisma.rolePermission.findMany({
    where: { role: { users: { some: { id: userId } } } },
    select: { permission: { select: { code: true } } },
  });
  return rows.map((row) => row.permission.code);
}

/**
 * Mọi user đang mang một vai trò — dùng bởi `permissionCache.evictRole`.
 *
 * Đây là chỗ dễ quên nhất của cả cơ chế cache: thay đổi xảy ra ở bảng `Role`
 * nhưng cache khóa theo `userId`, nên phải tra ngược ra danh sách rồi evict
 * từng người (SPEC §8, nguyên tắc 4).
 */
export async function findUserIdsByRoleId(roleId: string): Promise<string[]> {
  const rows = await prisma.user.findMany({ where: { roleId }, select: { id: true } });
  return rows.map((row) => row.id);
}
