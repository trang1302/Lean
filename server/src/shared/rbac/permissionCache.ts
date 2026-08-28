import { findPermissionCodesByUserId, findUserIdsByRoleId } from './rbac.repository.js';

/**
 * Cache tập quyền theo user, trong BỘ NHỚ TIẾN TRÌNH.
 *
 * ⚠️ ĐIỀU KIỆN CHẶN: cache này đúng **chỉ khi có đúng một tiến trình server**.
 * Chạy nhiều instance (PM2 cluster, nhiều container sau load balancer) thì nó
 * SAI theo kiểu im lặng: instance A hạ quyền của user rồi evict `Map` của
 * mình; B và C không có kênh nào để biết, vẫn cho quyền cũ tới hết TTL — và
 * kết quả phụ thuộc request rơi vào instance nào. Muốn scale ngang thì đổi
 * sang Redis key `lean:perm:{userId}` TRƯỚC (SPEC §8).
 *
 * Quyền CỐ Ý không nằm trong session: đổi vai trò có hiệu lực ngay ở request
 * kế tiếp, người dùng không phải đăng xuất rồi đăng nhập lại.
 */

interface Entry {
  codes: Set<string>;
  expiresAt: number;
}

/**
 * 30 phút, không phải 30 ngày như upip.
 *
 * Cache của upip nằm ở Redis nên sống qua restart, TTL dài mua được thứ có
 * giá. Cache này mất sạch mỗi lần restart nên TTL dài không mua thêm gì.
 * Ngược lại, TTL ngắn là LƯỚI AN TOÀN cho đúng một kịch bản: ai đó thêm một
 * đường sửa vai trò mới mà quên gọi evict. Với 30 ngày, lỗi đó là vĩnh viễn
 * trên thực tế; với 30 phút, nó tự lành.
 *
 * TTL KHÔNG phải cơ chế chính. Thấy mình dựa vào TTL để một thay đổi quyền có
 * hiệu lực nghĩa là đang thiếu một lời gọi evict.
 */
const TTL_MS = 30 * 60 * 1000;

const cache = new Map<string, Entry>();

/** Tiêm đồng hồ để test không phải chờ 30 phút thật. */
let now = (): number => Date.now();

export function __setClockForTest(clock: () => number): void {
  now = clock;
}

export function __resetClockForTest(): void {
  now = () => Date.now();
}

/**
 * Tập quyền của user. Miss (hoặc hết hạn) → đọc DB rồi lưu lại.
 *
 * Trả `Set` để guard chỉ cần `has()` — thao tác duy nhất nó làm.
 */
export async function getPermissionCodes(userId: string): Promise<Set<string>> {
  const hit = cache.get(userId);
  if (hit && hit.expiresAt > now()) return hit.codes;

  const codes = new Set(await findPermissionCodesByUserId(userId));
  cache.set(userId, { codes, expiresAt: now() + TTL_MS });
  return codes;
}

/** Gán vai trò khác, khóa/xóa tài khoản → gọi ngay trong service làm việc đó. */
export function evictUser(userId: string): void {
  cache.delete(userId);
}

/**
 * Sửa ma trận quyền của một vai trò → phải evict MỌI user mang vai trò đó.
 *
 * Không có đường tắt: cache khóa theo `userId` còn thay đổi xảy ra ở `Role`,
 * nên bắt buộc tra ngược danh sách user. Quên hàm này là sửa ma trận xong mà
 * người đang đăng nhập vẫn giữ quyền cũ tới 30 phút.
 */
export async function evictRole(roleId: string): Promise<void> {
  const userIds = await findUserIdsByRoleId(roleId);
  for (const userId of userIds) cache.delete(userId);
}

/** Seed/migration sửa DB ngoài luồng service → xóa sạch. */
export function clear(): void {
  cache.clear();
}

/** Chỉ dùng trong test để khẳng định cache thật sự được dùng/được xóa. */
export function __size(): number {
  return cache.size;
}
