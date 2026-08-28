import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../../src/lib/db.js';
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
}

export type Agent = ReturnType<typeof request.agent>;

export async function createTestUser(
  email: string,
  password = 'matkhaudai12',
): Promise<TestUser> {
  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password) },
  });
  return { id: user.id, email, password };
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
export async function loginAgent(app: Express, user: TestUser): Promise<Agent> {
  const agent = await anonAgent(app);
  const res = await loginWith(agent, user.email, user.password);

  if (res.status !== 200) {
    // Không để test đỏ ở một assert xa tít phía dưới với lý do khó hiểu.
    throw new Error(`loginAgent: đăng nhập thất bại (${res.status}) ${JSON.stringify(res.body)}`);
  }

  return agent;
}
