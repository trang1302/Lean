import { AppError } from '../../../shared/errors/AppError.js';
import { evictRole } from '../../../shared/rbac/permissionCache.js';
import type { PermissionView, RoleView } from '../dtos/rbac.response.js';
import * as rbacRepository from '../repositories/rbac.admin.repository.js';

/**
 * Ma trận Role × Permission. Đây LÀ cơ chế "ẩn chức năng khỏi vai trò" — không
 * có feature flag riêng, không có bảng override theo user.
 */

const SYSTEM_ADMIN = 'SYSTEM_ADMIN';
const RBAC_MANAGE = 'rbac:manage';

export async function listPermissions(): Promise<PermissionView[]> {
  return rbacRepository.listPermissions();
}

export async function listRoles(): Promise<RoleView[]> {
  const rows = await rbacRepository.listRolesWithUserCount();
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    userCount: row._count.users,
  }));
}

async function loadRoleOr404(roleId: string) {
  const role = await rbacRepository.findRoleById(roleId);
  if (!role) throw AppError.notFound('Không tìm thấy vai trò');
  return role;
}

export async function getRolePermissions(roleId: string): Promise<string[]> {
  await loadRoleOr404(roleId);
  return rbacRepository.findPermissionCodesByRoleId(roleId);
}

/**
 * Đặt lại tập quyền của một vai trò.
 *
 * Mọi quyền đều ẩn được tự do — kể cả gỡ `log:view` khỏi `USER`, kể cả gỡ
 * `user:manage` khỏi `ADMIN`. ĐÚNG MỘT ngoại lệ ở dưới.
 */
export async function setRolePermissions(roleId: string, codes: string[]): Promise<string[]> {
  const role = await loadRoleOr404(roleId);
  const wanted = [...new Set(codes)];

  // Ngoại lệ duy nhất của "ẩn được bất kỳ chức năng nào": gỡ `rbac:manage`
  // khỏi chính `SYSTEM_ADMIN` là khóa vĩnh viễn CHÍNH API vừa dùng — không ai
  // sửa lại được trừ khi vào DB bằng tay.
  if (role.code === SYSTEM_ADMIN && !wanted.includes(RBAC_MANAGE)) {
    const message = `Không gỡ được ${RBAC_MANAGE} khỏi vai trò quản trị hệ thống`;
    throw AppError.validation(message, [{ path: 'codes', message }]);
  }

  const found = await rbacRepository.findPermissionIdsByCodes(wanted);
  if (found.length !== wanted.length) {
    // Mã lạ phải là 400 ồn ào, không phải bị bỏ qua im lặng: gõ nhầm một mã mà
    // API vẫn trả 200 nghĩa là người dùng tin rằng đã cấp một quyền không tồn tại.
    const known = new Set(found.map((row) => row.code));
    const unknown = wanted.filter((code) => !known.has(code));
    throw AppError.validation('Dữ liệu gửi lên không hợp lệ', [
      { path: 'codes', message: `Mã quyền không tồn tại: ${unknown.join(', ')}` },
    ]);
  }

  await rbacRepository.replaceRolePermissions(
    roleId,
    found.map((row) => row.id),
  );

  // BẮT BUỘC, và là chỗ dễ quên nhất của cả cơ chế cache: thay đổi xảy ra ở
  // bảng Role nhưng cache khóa theo userId, nên phải tra ngược ra MỌI user
  // mang vai trò này rồi evict từng người. Quên là ma trận đã đổi mà người
  // đang đăng nhập vẫn giữ quyền cũ tới 30 phút.
  await evictRole(roleId);

  return rbacRepository.findPermissionCodesByRoleId(roleId);
}
