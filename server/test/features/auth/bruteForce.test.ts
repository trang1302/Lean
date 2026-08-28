import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/db.js';
import { anonAgent, createTestUser, loginWith, type Agent, type TestUser } from '../../helpers/auth.js';

const app = createApp();
let user: TestUser;
let anon: Agent;

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.user.deleteMany();
  user = await createTestUser('user@lean.local', 'matkhaudung12');
  anon = await anonAgent(app);
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function failLogin(email: string): Promise<number> {
  const res = await anon.post('/api/auth/login').send({ email, password: 'sai-roi-nhe' });
  return res.status;
}

describe('chống brute-force', () => {
  it('lần thất bại thứ 6 trong cửa sổ → 429 TOO_MANY_ATTEMPTS', async () => {
    for (let i = 0; i < 5; i += 1) {
      expect(await failLogin(user.email)).toBe(401);
    }

    const res = await anon.post('/api/auth/login').send({ email: user.email, password: 'sai-roi-nhe' });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_ATTEMPTS');
  });

  it('email KHÔNG tồn tại cũng bị khóa sau N lần — 429 không phải oracle', async () => {
    // Nếu chỉ email tồn tại mới bị khóa thì chính mã 429 tiết lộ email nào có
    // tài khoản, phá đúng mục tiêu mà `AppError.invalidCredentials()` phục vụ.
    for (let i = 0; i < 5; i += 1) await failLogin('khongco@lean.local');

    const res = await anon
      .post('/api/auth/login')
      .send({ email: 'khongco@lean.local', password: 'sai-roi-nhe' });

    expect(res.status).toBe(429);
  });

  it('mật khẩu ĐÚNG khi đang bị khóa vẫn 429 — không có đường tắt', async () => {
    for (let i = 0; i < 5; i += 1) await failLogin(user.email);

    const res = await anon.post('/api/auth/login').send({ email: user.email, password: user.password });

    expect(res.status).toBe(429);
  });

  it('đăng nhập thành công xóa bộ đếm thất bại của email đó', async () => {
    for (let i = 0; i < 4; i += 1) await failLogin(user.email);

    await loginWith(anon, user.email, user.password);

    expect(
      await prisma.loginAttempt.count({ where: { emailKey: user.email, succeeded: false } }),
    ).toBe(0);
  });

  it('ghi lần thử với email đã CHUẨN HÓA, không phải chuỗi thô', async () => {
    // Không chuẩn hóa thì "USER@Lean.Local" là một khóa đếm khác, và kẻ tấn công
    // nhân N lần ngưỡng chỉ bằng cách đổi hoa thường.
    await anon.post('/api/auth/login').send({ email: '  USER@Lean.Local ', password: 'sai-roi-nhe' });

    expect(await prisma.loginAttempt.count({ where: { emailKey: user.email } })).toBe(1);
  });

  it('lần thử BỊ CHẶN không được ghi thêm — nếu không cửa sổ tự gia hạn vô tận', async () => {
    // Ghi cả lần bị 429 nghĩa là mỗi lần gõ thêm lại đẩy mốc `createdAt` mới
    // nhất lên, và người dùng thật không bao giờ hết bị khóa.
    for (let i = 0; i < 5; i += 1) await failLogin(user.email);
    const afterLock = await prisma.loginAttempt.count({ where: { emailKey: user.email } });

    await failLogin(user.email);
    await failLogin(user.email);

    expect(await prisma.loginAttempt.count({ where: { emailKey: user.email } })).toBe(afterLock);
  });

  it('kiểm ngưỡng chạy TRƯỚC Argon2 — khóa rồi thì không tốn CPU verify nữa', async () => {
    // Verify Argon2 tốn hàng chục ms CÓ CHỦ ĐÍCH. Để kẻ tấn công kích hoạt nó
    // không giới hạn là biến chống-brute-force thành lỗ DoS.
    for (let i = 0; i < 5; i += 1) await failLogin(user.email);

    const started = Date.now();
    await anon.post('/api/auth/login').send({ email: user.email, password: user.password });
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(50);
  });
});

describe('kiểm soát phiên đồng thời', () => {
  it('đăng nhập lần hai làm cookie của phiên thứ nhất vô hiệu', async () => {
    const first = await anonAgent(app);
    await loginWith(first, user.email, user.password);
    expect((await first.get('/api/auth/session')).status).toBe(200);

    const second = await anonAgent(app);
    await loginWith(second, user.email, user.password);

    expect((await first.get('/api/auth/session')).status).toBe(401);
    expect((await second.get('/api/auth/session')).status).toBe(200);
  });

  it('chỉ đá phiên của CHÍNH user đó, không đụng người khác', async () => {
    const other = await createTestUser('other@lean.local');
    const otherAgent = await anonAgent(app);
    await loginWith(otherAgent, other.email, other.password);

    const mine = await anonAgent(app);
    await loginWith(mine, user.email, user.password);

    expect((await otherAgent.get('/api/auth/session')).status).toBe(200);
  });

  it('phiên mới VẪN SỐNG sau khi đá — không tự xóa chính mình', async () => {
    // `deleteSessionsByUserId` (không có `Except`) sẽ xóa luôn phiên vừa tạo:
    // đăng nhập xong là mất phiên ngay, và triệu chứng trông như "login hỏng".
    const agent = await anonAgent(app);
    await loginWith(agent, user.email, user.password);

    expect((await agent.get('/api/auth/session')).status).toBe(200);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
  });
});
