import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/db.js';
import {
  createTestUser,
  loginAgent,
  resetPermissionCache,
  type Agent,
  type TestUser,
} from '../../helpers/auth.js';

const app = createApp();

let admin: TestUser;
let sysadmin: TestUser;
let plain: TestUser;
let adminAgent: Agent;

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.bodyLog.deleteMany();
  await prisma.meal.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.user.deleteMany();
  resetPermissionCache();

  admin = await createTestUser('admin@lean.local', undefined, 'ADMIN');
  sysadmin = await createTestUser('system@lean.local', undefined, 'SYSTEM_ADMIN');
  plain = await createTestUser('user@lean.local', undefined, 'USER');
  adminAgent = await loginAgent(app, admin);
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function roleId(code: string): Promise<string> {
  return (await prisma.role.findUnique({ where: { code } }))!.id;
}

describe('GET /api/users — user:view là quyền xem TÀI KHOẢN', () => {
  it('trả danh sách, KHÔNG có passwordHash ở bất kỳ đâu', async () => {
    const res = await adminAgent.get('/api/users');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('KHÔNG kèm dữ liệu sức khỏe — ADMIN thấy email, không thấy cân nặng', async () => {
    // `user:view` và `log:view` là hai quyền khác nhau, và `log:view` của ADMIN
    // vẫn bị ownership giới hạn về dữ liệu của chính nó.
    await prisma.bodyLog.create({ data: { userId: plain.id, date: '2026-08-10', weightKg: 99 } });

    const res = await adminAgent.get('/api/users');

    expect(JSON.stringify(res.body)).not.toContain('99');
    expect(JSON.stringify(res.body)).not.toContain('weightKg');
  });

  it('kèm vai trò của từng tài khoản', async () => {
    const res = await adminAgent.get(`/api/users/${plain.id}`);

    expect(res.body.role.code).toBe('USER');
  });
});

describe('POST /api/users — vai trò không bao giờ đi qua thân request', () => {
  it('tài khoản do ADMIN tạo LUÔN là USER', async () => {
    const res = await adminAgent
      .post('/api/users')
      .send({ email: 'moi@lean.local', password: 'matkhaudai12' });

    expect(res.status).toBe(201);
    expect(res.body.role.code).toBe('USER');
  });

  it('gửi kèm roleId của SYSTEM_ADMIN → 400, KHÔNG phải bị bỏ qua im lặng', async () => {
    // Đường leo thang quyền hoàn chỉnh nếu thiếu `.strict()`: ADMIN tạo một
    // tài khoản SYSTEM_ADMIN rồi đăng nhập vào đó.
    const res = await adminAgent.post('/api/users').send({
      email: 'moi@lean.local',
      password: 'matkhaudai12',
      roleId: await roleId('SYSTEM_ADMIN'),
    });

    expect(res.status).toBe(400);
    expect(await prisma.user.findUnique({ where: { email: 'moi@lean.local' } })).toBeNull();
  });

  it('email trùng → 400 với fields[].path = email', async () => {
    const res = await adminAgent
      .post('/api/users')
      .send({ email: plain.email, password: 'matkhaudai12' });

    expect(res.status).toBe(400);
    expect(res.body.error.fields[0].path).toBe('email');
  });

  it('mật khẩu dưới 8 ký tự → 400 (đường ĐẶT mật khẩu vẫn siết)', async () => {
    const res = await adminAgent
      .post('/api/users')
      .send({ email: 'moi@lean.local', password: '123456' });

    expect(res.status).toBe(400);
  });
});

describe('ADMIN không đụng được tài khoản SYSTEM_ADMIN', () => {
  it.each([
    ['sửa', (agent: Agent, id: string) => agent.patch(`/api/users/${id}`).send({ status: 'disabled' })],
    ['xóa', (agent: Agent, id: string) => agent.delete(`/api/users/${id}`)],
    ['reset mật khẩu', (agent: Agent, id: string) => agent.post(`/api/users/${id}/password`).send({ password: 'matkhaumoi12' })],
  ])('%s → 403, hàng không đổi', async (_label, call) => {
    // Thiếu chốt này thì ADMIN reset mật khẩu SYSTEM_ADMIN rồi đăng nhập vào —
    // chiếm hệ thống mà không cần rbac:manage.
    const res = await call(adminAgent, sysadmin.id);

    expect(res.status).toBe(403);
    const after = await prisma.user.findUnique({ where: { id: sysadmin.id } });
    expect(after).not.toBeNull();
    expect(after!.status).toBe('active');
  });

  it('403 chứ KHÔNG 404 — ADMIN đã thấy tài khoản đó ở màn danh sách', async () => {
    const list = await adminAgent.get('/api/users');
    expect(JSON.stringify(list.body)).toContain(sysadmin.email);

    expect((await adminAgent.delete(`/api/users/${sysadmin.id}`)).status).toBe(403);
  });

  it('SYSTEM_ADMIN thì làm được — chốt dựa trên QUYỀN, không phải tên vai trò', async () => {
    const sysAgent = await loginAgent(app, sysadmin);
    const other = await createTestUser('sys2@lean.local', undefined, 'SYSTEM_ADMIN');

    expect((await sysAgent.patch(`/api/users/${other.id}`).send({ status: 'disabled' })).status).toBe(200);
  });
});

describe('không tự khóa mình ra khỏi hệ thống', () => {
  it('tự xóa tài khoản của chính mình → 400', async () => {
    // onDelete: Cascade nghĩa là tự xóa mình xóa luôn toàn bộ nhật ký của mình.
    const res = await adminAgent.delete(`/api/users/${admin.id}`);

    expect(res.status).toBe(400);
    expect(await prisma.user.findUnique({ where: { id: admin.id } })).not.toBeNull();
  });

  it('khóa SYSTEM_ADMIN hoạt động cuối cùng → 400', async () => {
    const sysAgent = await loginAgent(app, sysadmin);
    const second = await createTestUser('sys2@lean.local', undefined, 'SYSTEM_ADMIN');
    // Còn hai thì khóa được một.
    expect((await sysAgent.patch(`/api/users/${second.id}`).send({ status: 'disabled' })).status).toBe(200);

    // Giờ chính nó là người cuối cùng.
    const res = await sysAgent.patch(`/api/users/${sysadmin.id}`).send({ status: 'disabled' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('tự đổi vai trò của chính mình → 400', async () => {
    const sysAgent = await loginAgent(app, sysadmin);

    const res = await sysAgent
      .put(`/api/users/${sysadmin.id}/role`)
      .send({ roleId: await roleId('USER') });

    expect(res.status).toBe(400);
    expect(res.body.error.fields[0].path).toBe('roleId');
  });
});

describe('PUT /api/users/:id/role — evict phải chạy', () => {
  it('nâng USER lên ADMIN → quyền mới có hiệu lực NGAY, không chờ TTL', async () => {
    const plainAgent = await loginAgent(app, plain);
    expect((await plainAgent.get('/api/users')).status).toBe(403);

    const sysAgent = await loginAgent(app, sysadmin);
    const res = await sysAgent
      .put(`/api/users/${plain.id}/role`)
      .send({ roleId: await roleId('ADMIN') });
    expect(res.status).toBe(200);
    expect(res.body.role.code).toBe('ADMIN');

    // Cùng cookie cũ, không đăng nhập lại — quyền không nằm trong phiên.
    expect((await plainAgent.get('/api/users')).status).toBe(200);
  });

  it('hạ ADMIN xuống USER → mất quyền NGAY', async () => {
    const sysAgent = await loginAgent(app, sysadmin);
    expect((await adminAgent.get('/api/users')).status).toBe(200);

    await sysAgent.put(`/api/users/${admin.id}/role`).send({ roleId: await roleId('USER') });

    expect((await adminAgent.get('/api/users')).status).toBe(403);
  });

  it('roleId không tồn tại → 400', async () => {
    const sysAgent = await loginAgent(app, sysadmin);

    const res = await sysAgent.put(`/api/users/${plain.id}/role`).send({ roleId: 'khong-co' });

    expect(res.status).toBe(400);
  });
});

describe('thu hồi phiên', () => {
  it('reset mật khẩu → mọi phiên của user đó chết', async () => {
    const plainAgent = await loginAgent(app, plain);
    expect((await plainAgent.get('/api/auth/session')).status).toBe(200);

    await adminAgent.post(`/api/users/${plain.id}/password`).send({ password: 'matkhaumoi12' });

    expect((await plainAgent.get('/api/auth/session')).status).toBe(401);
  });

  it('khóa tài khoản → phiên đang mở chết ngay, không đợi cookie hết hạn', async () => {
    const plainAgent = await loginAgent(app, plain);

    await adminAgent.patch(`/api/users/${plain.id}`).send({ status: 'disabled' });

    expect((await plainAgent.get('/api/auth/session')).status).toBe(401);
  });

  it('mật khẩu mới đăng nhập được, mật khẩu cũ thì không', async () => {
    await adminAgent.post(`/api/users/${plain.id}/password`).send({ password: 'matkhaumoi12' });

    const { anonAgent, loginWith } = await import('../../helpers/auth.js');
    const fresh = await anonAgent(app);

    expect((await loginWith(fresh, plain.email, 'matkhaumoi12')).status).toBe(200);
    const stale = await anonAgent(app);
    expect((await loginWith(stale, plain.email, plain.password)).status).toBe(401);
  });
});
