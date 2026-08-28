import { AppError } from '../../../shared/errors/AppError.js';
import { evictUser } from '../../../shared/rbac/permissionCache.js';
import { hashPassword } from '../../../shared/security/password.js';
import { revokeAllSessions } from '../../auth/services/auth.service.js';
import type { CreateUserInput, UpdateUserInput } from '../dtos/users.request.js';
import { toUserView, type UserView } from '../dtos/users.response.js';
import * as usersRepository from '../repositories/users.repository.js';

/**
 * Bất biến quản trị tài khoản. Đây là tầng DUY NHẤT giữ chúng — controller chỉ
 * validate và gọi xuống, repository chỉ đọc/ghi.
 *
 * Ranh giới với `permissionGuard`: guard trả lời "chức năng này có được dùng
 * không" (method + path + tập quyền, không đọc DB nghiệp vụ). Tầng này trả lời
 * "HÀNG NÀY có được đụng không" — cùng loại với ownership, và vì thế bắt buộc
 * phải ở đây chứ không ở guard (design doc §4.2).
 */

const SYSTEM_ADMIN = 'SYSTEM_ADMIN';

/** Vai trò của MỌI tài khoản tạo qua API quản trị. Không đọc từ body. */
const DEFAULT_ROLE_CODE = 'USER';

export interface Actor {
  id: string;
  /**
   * Người gọi có `rbac:manage` hay không.
   *
   * CỐ Ý là một mã quyền, không phải role code: `if (user.role === 'ADMIN')` là
   * thứ rbac/SPEC.md §6 cấm, và nó cũng sai về nghĩa — cái quyết định ở đây là
   * "được sửa phân quyền hay không", không phải "tên vai trò là gì".
   */
  canManageRbac: boolean;
}

async function loadUserOr404(id: string) {
  const user = await usersRepository.findUserById(id);
  if (!user) throw AppError.notFound('Không tìm thấy tài khoản');
  return user;
}

/**
 * Chặn đường leo thang quyền chính: `ADMIN` chỉ có `user:manage` mà lại sửa /
 * khóa / xóa / reset mật khẩu được tài khoản `SYSTEM_ADMIN` thì nó chiếm được
 * hệ thống mà không cần `rbac:manage` — và cấp bậc vai trò chỉ còn trên danh nghĩa.
 *
 * `403` chứ KHÔNG `404`: người gọi có `user:view` nên đã thấy tài khoản đó ở
 * màn danh sách. Trả `404` cho một hàng vừa hiện ra là tự mâu thuẫn và không
 * che giấu được gì (khác hẳn ownership, nơi `404` thật sự giấu được sự tồn tại).
 */
function assertMayTouch(actor: Actor, target: { role: { code: string } | null }): void {
  if (target.role?.code === SYSTEM_ADMIN && !actor.canManageRbac) {
    throw AppError.forbidden('Không thao tác được trên tài khoản quản trị hệ thống');
  }
}

/** Còn 0 `SYSTEM_ADMIN` hoạt động là không ai gán được vai trò nữa — phải sửa DB bằng tay. */
async function assertNotLastSystemAdmin(
  target: { id: string; status: string; role: { code: string } | null },
  message: string,
): Promise<void> {
  if (target.role?.code !== SYSTEM_ADMIN) return;
  if (target.status !== 'active') return; // đã không tính vào bộ đếm

  const remaining = await usersRepository.countActiveUsersWithRoleCode(SYSTEM_ADMIN);
  if (remaining <= 1) throw AppError.validation(message, [{ path: 'id', message }]);
}

export async function listUsers(): Promise<UserView[]> {
  return (await usersRepository.listUsers()).map(toUserView);
}

export async function getUser(id: string): Promise<UserView> {
  return toUserView(await loadUserOr404(id));
}

export async function createUser(input: CreateUserInput): Promise<UserView> {
  if (await usersRepository.emailExists(input.email)) {
    throw AppError.validation('Dữ liệu gửi lên không hợp lệ', [
      { path: 'email', message: 'Email này đã được dùng' },
    ]);
  }

  // Vai trò gán CỨNG. `createUserSchema` đã `.strict()` nên `roleId` trong body
  // là 400; dòng này là lớp thứ hai, phòng khi ai đó nới schema ra.
  const roleId = await usersRepository.findRoleIdByCode(DEFAULT_ROLE_CODE);

  const user = await usersRepository.createUser({
    email: input.email,
    passwordHash: await hashPassword(input.password),
    displayName: input.displayName ?? null,
    roleId,
  });
  return toUserView(user);
}

export async function updateUser(
  actor: Actor,
  id: string,
  input: UpdateUserInput,
): Promise<UserView> {
  const target = await loadUserOr404(id);
  assertMayTouch(actor, target);

  if (input.status === 'disabled') {
    await assertNotLastSystemAdmin(
      target,
      'Không khóa được tài khoản quản trị hệ thống cuối cùng',
    );
    // Khóa tài khoản mà để phiên sống là khóa trên danh nghĩa: người đó vẫn
    // dùng tiếp tới khi cookie hết hạn.
    await revokeAllSessions(id);
  }

  const updated = await usersRepository.updateUser(id, {
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
  });
  evictUser(id);
  return toUserView(updated);
}

export async function deleteUser(actor: Actor, id: string): Promise<void> {
  // Tự xóa mình TRƯỚC mọi kiểm tra khác: `onDelete: Cascade` nghĩa là nó xóa
  // luôn toàn bộ nhật ký cân nặng, bữa ăn, mục tiêu của chính mình. Một cú bấm
  // nhầm không được phép làm việc đó.
  if (actor.id === id) {
    throw AppError.validation('Không tự xóa được tài khoản của chính mình', [
      { path: 'id', message: 'Không tự xóa được tài khoản của chính mình' },
    ]);
  }

  const target = await loadUserOr404(id);
  assertMayTouch(actor, target);
  await assertNotLastSystemAdmin(target, 'Không xóa được tài khoản quản trị hệ thống cuối cùng');

  await revokeAllSessions(id);
  await usersRepository.deleteUser(id);
  evictUser(id);
}

export async function resetPassword(actor: Actor, id: string, password: string): Promise<void> {
  const target = await loadUserOr404(id);
  assertMayTouch(actor, target);

  await usersRepository.updatePasswordHash(id, await hashPassword(password));
  // Đổi mật khẩu mà không thu hồi phiên thì phiên cũ vẫn sống — đúng thứ mà
  // việc reset mật khẩu sinh ra để chặn.
  await revokeAllSessions(id);
}

export async function assignRole(actor: Actor, id: string, roleId: string): Promise<UserView> {
  const target = await loadUserOr404(id);

  const role = await usersRepository.findRoleById(roleId);
  if (!role) {
    throw AppError.validation('Dữ liệu gửi lên không hợp lệ', [
      { path: 'roleId', message: 'Vai trò không tồn tại' },
    ]);
  }

  // Đổi vai trò của CHÍNH MÌNH — chặn cả hai chiều. Hạ mình là ca riêng của
  // "không để hệ thống còn 0 SYSTEM_ADMIN" nhưng cần thông báo khác để người
  // dùng hiểu chuyện gì vừa xảy ra; nâng mình thì không đời nào.
  if (actor.id === id && role.id !== target.role?.id) {
    throw AppError.validation('Không tự đổi được vai trò của chính mình', [
      { path: 'roleId', message: 'Không tự đổi được vai trò của chính mình' },
    ]);
  }

  if (role.code !== SYSTEM_ADMIN) {
    await assertNotLastSystemAdmin(
      target,
      'Không hạ được tài khoản quản trị hệ thống cuối cùng',
    );
  }

  const updated = await usersRepository.updateRole(id, roleId);
  // BẮT BUỘC: tập quyền cache theo userId, không evict là người vừa bị hạ vẫn
  // giữ quyền cũ tới hết TTL 30 phút.
  evictUser(id);
  return toUserView(updated);
}
