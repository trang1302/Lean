import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/db.js';
import { hashPassword } from '../../../src/shared/security/password.js';

const app = createApp();

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.user.deleteMany();
  await prisma.user.create({
    data: {
      email: 'user@lean.local',
      passwordHash: await hashPassword('123456'),
      displayName: 'Người dùng',
    },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('đăng ký thành công → 201, KHÔNG có passwordHash trong body', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'moi@lean.local', password: 'matkhaudai12' });

    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(res.body.user.email).toBe('moi@lean.local');
  });

  it('mật khẩu 6 ký tự → 400: min 8 áp ở đường ĐẶT mật khẩu', async () => {
    // Đối xứng với ca "123456 đăng nhập được" bên dưới. Hai ca này cùng nhau
    // mã hóa quyết định 4 của design doc: policy độ dài thuộc lúc tạo, không
    // thuộc lúc xác thực.
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ngan@lean.local', password: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.some((f: { path: string }) => f.path === 'password')).toBe(true);
  });

  it('email trùng → 400 với fields chỉ vào email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'user@lean.local', password: 'matkhaudai12' });

    expect(res.status).toBe(400);
    expect(res.body.error.fields[0].path).toBe('email');
  });

  it('email khác hoa thường vẫn là trùng — chuẩn hóa ở DTO', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: '  USER@Lean.Local  ', password: 'matkhaudai12' });

    expect(res.status).toBe(400);
  });

  it('email được lưu ở dạng đã chuẩn hóa, không lưu nguyên văn người gửi', async () => {
    // Nếu chuẩn hóa chỉ chạy lúc kiểm trùng mà không áp vào giá trị đem đi lưu,
    // hai tài khoản 'A@x.com' và 'a@x.com' vẫn vào được DB qua hai request khác
    // nhau — @unique của SQLite phân biệt hoa thường.
    await request(app)
      .post('/api/auth/register')
      .send({ email: '  MoiNua@Lean.Local  ', password: 'matkhaudai12' });

    expect(await prisma.user.findUnique({ where: { email: 'moinua@lean.local' } })).not.toBeNull();
  });
});

describe('POST /api/auth/login', () => {
  it('đúng mật khẩu → 200, Set-Cookie có HttpOnly', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@lean.local', password: '123456' });

    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(';')).toMatch(/HttpOnly/i);
    expect(cookies.join(';')).toMatch(/lean\.sid/);
  });

  it('mật khẩu 6 ký tự đăng nhập ĐƯỢC — không áp min 8 ở đường login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@lean.local', password: '123456' });

    expect(res.status).toBe(200);
  });

  it('sai mật khẩu và email không tồn tại trả GIỐNG HỆT nhau', async () => {
    // auth/SPEC.md §7.3: phân biệt hai ca biến form đăng nhập thành công cụ
    // liệt kê tài khoản. Với app sức khỏe, "email này có tài khoản" đã là
    // thông tin riêng tư.
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@lean.local', password: 'sai-mat-khau' });
    const noSuchEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'khongco@lean.local', password: 'sai-mat-khau' });

    expect(wrongPassword.status).toBe(401);
    expect(noSuchEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(noSuchEmail.body);
  });

  it('email sai định dạng → 400 kèm fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'khong-phai-email', password: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('status disabled + mật khẩu ĐÚNG → 403 ACCOUNT_DISABLED', async () => {
    await prisma.user.update({
      where: { email: 'user@lean.local' },
      data: { status: 'disabled' },
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@lean.local', password: '123456' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('status disabled + mật khẩu SAI → 401, không lộ việc tài khoản bị khóa', async () => {
    await prisma.user.update({
      where: { email: 'user@lean.local' },
      data: { status: 'disabled' },
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@lean.local', password: 'sai' });

    expect(res.status).toBe(401);
  });

  it('đăng nhập KHÔNG ghi phiên của user khác, và chỉ tạo đúng một phiên', async () => {
    await request(app).post('/api/auth/login').send({ email: 'user@lean.local', password: '123456' });

    const rows = await prisma.session.findMany();
    expect(rows).toHaveLength(1);
    const user = await prisma.user.findUnique({ where: { email: 'user@lean.local' } });
    expect(rows[0]?.userId).toBe(user!.id);
  });

  it('session id ĐỔI mỗi lần đăng nhập lại (chống session fixation)', async () => {
    // Plan viết ca này bằng `agent.get('/api/auth/csrf')` để tạo phiên trước khi
    // đăng nhập, nhưng route đó thuộc Task 6 và `saveUninitialized: false` khiến
    // phiên vô danh KHÔNG được ghi — nên `before` luôn rỗng và phép so sánh
    // "có id mới" xanh mà chẳng chứng minh gì.
    //
    // Đăng nhập HAI lần trên cùng agent thì chứng minh được thật: nếu
    // `regenerate` không chạy, lần hai dùng lại đúng session id của lần một.
    const agent = request.agent(app);

    await agent.post('/api/auth/login').send({ email: 'user@lean.local', password: '123456' });
    const first = await prisma.session.findMany();

    await agent.post('/api/auth/login').send({ email: 'user@lean.local', password: '123456' });
    const second = await prisma.session.findMany();

    expect(first).toHaveLength(1);
    expect(second.some((s) => s.id !== first[0]!.id)).toBe(true);
  });
});

describe('GET /api/auth/session', () => {
  it('không cookie → 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/auth/session');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('có cookie → 200, KHÔNG có passwordHash ở bất kỳ đâu trong body', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'user@lean.local', password: '123456' });

    const res = await agent.get('/api/auth/session');

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('user@lean.local');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('phiên trỏ vào user đã bị xóa → 401, không phải 500', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'user@lean.local', password: '123456' });

    await prisma.user.deleteMany();

    const res = await agent.get('/api/auth/session');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('đăng xuất → 204, sau đó GET /session trả 401', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'user@lean.local', password: '123456' });

    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/session')).status).toBe(401);
  });

  it('đăng xuất khi CHƯA đăng nhập vẫn 204 (idempotent)', async () => {
    // Trả 401 ở đây chỉ tạo nhánh lỗi cho hành động vốn đã đạt mục đích:
    // người dùng muốn hết đăng nhập, và họ đang hết đăng nhập.
    expect((await request(app).post('/api/auth/logout')).status).toBe(204);
  });

  it('đăng xuất XÓA hàng phiên khỏi DB, không chỉ xóa cookie', async () => {
    // Xóa cookie mà để hàng phiên sống là để lại một session id còn hiệu lực:
    // ai giữ được id đó vẫn dùng lại được.
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'user@lean.local', password: '123456' });
    expect(await prisma.session.count()).toBe(1);

    await agent.post('/api/auth/logout');

    expect(await prisma.session.count()).toBe(0);
  });
});
