import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../../src/lib/db.js';
import { clear as clearPermissionCache } from '../../src/shared/rbac/permissionCache.js';
import { hashPassword } from '../../src/shared/security/password.js';

/**
 * Helper dựng user thật + agent supertest đã đăng nhập.
 *
 * Thay hoàn toàn `seedTestUsers()` — bản vá tạm dựng hai hàng `User` có id cố
 * định (`local`, `someone-else`) để bốn bảng dữ liệu qua được khóa ngoại khi
 * chưa có auth. Từ khi `userId` đến từ phiên, test phải đi qua đúng đường mà
 * người dùng thật đi: tạo user → đăng nhập → gọi API bằng cookie.
 */

export interface TestUser {
  id: string;
  email: string;
  password: string;
  roleCode: RoleCode;
}

export type Agent = ReturnType<typeof request.agent>;

/** Ba vai trò của seed. `null` = tài khoản chưa được cấp vai trò (tập quyền rỗng). */
export type RoleCode = 'USER' | 'ADMIN' | 'SYSTEM_ADMIN' | null;

/**
 * Vai trò và quyền do `test/globalSetup.ts` seed một lần cho cả run — test
 * không tự tạo vai trò, nó chỉ tra id theo `code`.
 */
async function roleIdByCode(code: RoleCode): Promise<string | null> {
  if (code === null) return null;
  const role = await prisma.role.findUnique({ where: { code }, select: { id: true } });
  if (!role) throw new Error(`Chưa seed vai trò '${code}' — kiểm tra test/globalSetup.ts`);
  return role.id;
}

/**
 * Mặc định `USER`: đủ 6 quyền dữ liệu cá nhân, tức là mọi test feature hiện có
 * chạy như trước khi có RBAC. Test quản trị truyền `'ADMIN'` hoặc
 * `'SYSTEM_ADMIN'`; test "chưa được cấp quyền" truyền `null`.
 */
export async function createTestUser(
  email: string,
  password = 'matkhaudai12',
  roleCode: RoleCode = 'USER',
): Promise<TestUser> {
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      roleId: await roleIdByCode(roleCode),
    },
  });
  return { id: user.id, email, password, roleCode };
}

/**
 * Lấy CSRF token hiện hành và gắn làm header mặc định cho MỌI request sau đó
 * của agent.
 *
 * Phải gọi LẠI sau mỗi lần đăng nhập/đăng xuất: token buộc vào
 * `req.session.userId` (xem `src/shared/security/csrf.ts`), nên nó hết hiệu
 * lực đúng lúc phiên bắt đầu hoặc kết thúc.
 */
export async function attachCsrf(agent: Agent): Promise<Agent> {
  const res = await agent.get('/api/auth/csrf');
  agent.set('x-csrf-token', res.body.csrfToken as string);
  return agent;
}

/** Agent chưa đăng nhập nhưng đã cầm CSRF token — đủ để POST /register, /login. */
export async function anonAgent(app: Express): Promise<Agent> {
  return attachCsrf(request.agent(app));
}

/**
 * Đăng nhập trên một agent có sẵn và tự làm mới CSRF token khi thành công.
 * Trả về nguyên response để test còn assert status/body.
 */
export async function loginWith(agent: Agent, email: string, password: string) {
  const res = await agent.post('/api/auth/login').send({ email, password });
  if (res.status === 200) await attachCsrf(agent);
  return res;
}

/**
 * Agent đã đăng nhập, sẵn sàng gọi mọi endpoint dữ liệu.
 *
 * `request.agent(app)` giữ cookie giữa các request — khác `request(app)` vốn
 * tạo request độc lập và vì thế luôn nhận 401 sau khi có `requireAuth`.
 *
 * KHÔNG tắt CSRF trong test — làm thế là test một app khác với app chạy thật.
 */
/**
 * Xóa cache quyền. BẮT BUỘC gọi ở `beforeEach` của test nào xóa rồi tạo lại
 * user: cuid có thể trùng lại? Không — nhưng cache sống xuyên suốt file test,
 * và một ca sửa ma trận quyền sẽ làm bẩn ca sau nếu không dọn.
 */
export function resetPermissionCache(): void {
  clearPermissionCache();
}

export async function loginAgent(app: Express, user: TestUser): Promise<Agent> {
  const agent = await anonAgent(app);
  const res = await loginWith(agent, user.email, user.password);

  if (res.status !== 200) {
    // Không để test đỏ ở một assert xa tít phía dưới với lý do khó hiểu.
    throw new Error(`loginAgent: đăng nhập thất bại (${res.status}) ${JSON.stringify(res.body)}`);
  }

  return agent;
}
