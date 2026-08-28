import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/db.js';
import { createTestUser, loginAgent, type TestUser } from '../../helpers/auth.js';

const app = createApp();
let user: TestUser;

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.user.deleteMany();
  user = await createTestUser('user@lean.local');
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Đây là test canh CHỐT CHẶN, không phải test một endpoint.
 *
 * Nó tồn tại để trả lời một câu duy nhất: "có route dữ liệu nào lọt ra ngoài
 * `requireAuth` không?". Vì `requireAuth` mắc MỘT lần ở `app.ts` cho cả năm
 * router, mất dòng đó là mở toang toàn bộ dữ liệu sức khỏe — và không một test
 * feature nào bắt được, vì chúng đều chạy dưới một agent đã đăng nhập.
 */
describe('requireAuth chặn năm router dữ liệu', () => {
  it.each([
    ['/api/goal'],
    ['/api/summary?from=2026-08-01&to=2026-08-10'],
    ['/api/reminders'],
    ['/api/body-logs?from=2026-08-01&to=2026-08-10'],
    ['/api/meals?date=2026-08-10'],
  ])('%s không phiên → 401 UNAUTHORIZED', async (path) => {
    const res = await request(app).get(path);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('/api/health vẫn công khai', async () => {
    expect((await request(app).get('/api/health')).status).toBe(200);
  });

  it('đã đăng nhập → vào được /api/goal', async () => {
    const agent = await loginAgent(app, user);

    expect((await agent.get('/api/goal')).status).toBe(200);
  });
});

describe('helmet', () => {
  it('gắn security header vào response', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('CSRF', () => {
  it('GET /api/auth/csrf trả token', async () => {
    const res = await request(app).get('/api/auth/csrf');

    expect(res.status).toBe(200);
    expect(typeof res.body.csrfToken).toBe('string');
  });

  it('PUT không kèm CSRF token → 403 CSRF_ERROR, không phải 500', async () => {
    // 500 ở đây nghĩa là `errorHandler` mất nhánh nhận diện `EBADCSRFTOKEN` —
    // client sẽ thấy "lỗi máy chủ" cho một tình huống hoàn toàn bình thường.
    const agent = await loginAgent(app, user);

    const res = await agent
      .put('/api/goal')
      .set('x-csrf-token', '')
      .send({ targetWeightKg: 68 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_ERROR');
  });

  it('PUT kèm CSRF token đúng → không bị 403', async () => {
    const agent = await loginAgent(app, user);

    const res = await agent.put('/api/goal').send({ targetWeightKg: 68 });

    expect(res.status).not.toBe(403);
  });

  it('token lấy lúc CÒN VÔ DANH không dùng được sau khi đăng nhập', async () => {
    // Khóa lại hệ quả của `getSessionIdentifier` (shared/security/csrf.ts):
    // định danh đổi từ '' sang userId khi phiên bắt đầu. Ai bỏ bước "lấy lại
    // token sau đăng nhập" trong `loginAgent` sẽ làm test này đỏ, thay vì thấy
    // 403 bí ẩn rải rác khắp các suite khác.
    const agent = request.agent(app);
    const anonCsrf = await agent.get('/api/auth/csrf');
    const anonToken = anonCsrf.body.csrfToken as string;

    await agent
      .post('/api/auth/login')
      .set('x-csrf-token', anonToken)
      .send({ email: user.email, password: user.password });

    const res = await agent
      .put('/api/goal')
      .set('x-csrf-token', anonToken)
      .send({ targetWeightKg: 68 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_ERROR');
  });
});
