import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/db.js';
import { seedRbac } from '../../../prisma/seed/rbac.seed.js';
import {
  createTestUser,
  loginAgent,
  resetPermissionCache,
  type Agent,
  type TestUser,
} from '../../helpers/auth.js';

const app = createApp();

let sysadmin: TestUser;
let sysAgent: Agent;

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  resetPermissionCache();
  // Ca sửa ma trận làm bẩn dữ liệu tham chiếu dùng chung cho cả run — dựng lại
  // trước MỖI ca thay vì cố nhớ dọn ở cuối từng ca.
  await seedRbac({ backfill: false });

  sysadmin = await createTestUser('system@lean.local', undefined, 'SYSTEM_ADMIN');
  sysAgent = await loginAgent(app, sysadmin);
});

afterAll(async () => {
  await seedRbac({ backfill: false });
  await prisma.$disconnect();
});

async function roleId(code: string): Promise<string> {
  return (await prisma.role.findUnique({ where: { code } }))!.id;
}

describe('GET /api/permissions — danh mục quyền', () => {
  it('trả đủ 10 quyền, sắp theo sequence', async () => {
    const res = await sysAgent.get('/api/permissions');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(10);
    const sequences = res.body.map((p: { sequence: number }) => p.sequence);
    expect(sequences).toEqual([...sequences].sort((a: number, b: number) => a - b));
  });

  it('mỗi quyền mang resource + action tách rời để màn Phân quyền nhóm được', async () => {
    const res = await sysAgent.get('/api/permissions');
    const logView = res.body.find((p: { code: string }) => p.code === 'log:view');

    expect(logView).toMatchObject({ resource: 'log', action: 'view' });
  });
});

describe('GET /api/roles', () => {
  it('trả 3 vai trò kèm số tài khoản đang mang', async () => {
    await createTestUser('u1@lean.local', undefined, 'USER');
    await createTestUser('u2@lean.local', undefined, 'USER');

    const res = await sysAgent.get('/api/roles');

    expect(res.status).toBe(200);
    expect(res.body.map((r: { code: string }) => r.code)).toEqual([
      'USER',
      'ADMIN',
      'SYSTEM_ADMIN',
    ]);
    const user = res.body.find((r: { code: string }) => r.code === 'USER');
    expect(user.userCount).toBe(2);
  });
});

describe('GET /api/roles/:id/permissions', () => {
  it('USER có đúng 6 quyền dữ liệu, không có quyền quản trị', async () => {
    const res = await sysAgent.get(`/api/roles/${await roleId('USER')}/permissions`);

    expect(res.body.codes).toHaveLength(6);
    expect(res.body.codes).not.toContain('user:view');
  });

  it('ADMIN có user:* nhưng KHÔNG có rbac:*', async () => {
    const res = await sysAgent.get(`/api/roles/${await roleId('ADMIN')}/permissions`);

    expect(res.body.codes).toContain('user:manage');
    expect(res.body.codes).not.toContain('rbac:manage');
  });

  it('vai trò không tồn tại → 404', async () => {
    expect((await sysAgent.get('/api/roles/khong-co/permissions')).status).toBe(404);
  });
});

describe('PUT /api/roles/:id/permissions — ĐÂY là cơ chế ẩn chức năng', () => {
  it('thay thế toàn bộ tập quyền, không cộng dồn', async () => {
    const id = await roleId('USER');

    const res = await sysAgent.put(`/api/roles/${id}/permissions`).send({ codes: ['log:view'] });

    expect(res.status).toBe(200);
    expect(res.body.codes).toEqual(['log:view']);
  });

  it('ẩn được chức năng khỏi vai trò, có hiệu lực NGAY với người đang đăng nhập', async () => {
    // Bài kiểm bắt buộc của `evictRole` (rbac/SPEC.md §8). Phải chờ TTL mới
    // xanh nghĩa là đang thiếu một lời gọi evict.
    const user = await createTestUser('u@lean.local', undefined, 'USER');
    const userAgent = await loginAgent(app, user);
    expect((await userAgent.get('/api/goal')).status).toBe(200);

    await sysAgent
      .put(`/api/roles/${await roleId('USER')}/permissions`)
      .send({ codes: ['log:view', 'log:manage'] });

    expect((await userAgent.get('/api/goal')).status).toBe(403);
  });

  it('gỡ rbac:manage khỏi SYSTEM_ADMIN → 400, ngoại lệ DUY NHẤT', async () => {
    // Gỡ xong thì chính API vừa dùng bị khóa vĩnh viễn, không ai sửa lại được
    // trừ khi vào DB bằng tay.
    const id = await roleId('SYSTEM_ADMIN');

    const res = await sysAgent.put(`/api/roles/${id}/permissions`).send({ codes: ['log:view'] });

    expect(res.status).toBe(400);
    expect(res.body.error.fields[0].message).toContain('rbac:manage');

    // Ma trận không đổi.
    const after = await sysAgent.get(`/api/roles/${id}/permissions`);
    expect(after.body.codes).toContain('rbac:manage');
  });

  it('gỡ user:manage khỏi ADMIN thì được — mọi quyền khác ẩn tự do', async () => {
    const id = await roleId('ADMIN');

    const res = await sysAgent.put(`/api/roles/${id}/permissions`).send({ codes: ['log:view'] });

    expect(res.status).toBe(200);
    expect(res.body.codes).toEqual(['log:view']);
  });

  it('mã quyền không tồn tại → 400 ồn ào, không bỏ qua im lặng', async () => {
    // Trả 200 cho một mã gõ sai nghĩa là người dùng tin rằng đã cấp một quyền
    // không hề tồn tại.
    const res = await sysAgent
      .put(`/api/roles/${await roleId('USER')}/permissions`)
      .send({ codes: ['log:view', 'logs:view'] });

    expect(res.status).toBe(400);
    expect(res.body.error.fields[0].message).toContain('logs:view');
  });

  it('khóa lạ trong body → 400 (.strict)', async () => {
    const res = await sysAgent
      .put(`/api/roles/${await roleId('USER')}/permissions`)
      .send({ codes: ['log:view'], roleCode: 'SYSTEM_ADMIN' });

    expect(res.status).toBe(400);
  });
});

describe('không có đường tạo/xóa vai trò qua API', () => {
  it.each([
    ['POST', '/api/roles'],
    ['DELETE', '/api/roles/x'],
    ['POST', '/api/permissions'],
  ])('%s %s không tồn tại → 403 mặc-định-từ-chối', async (method, path) => {
    // Danh mục vai trò/quyền là ĐÓNG. Một UI tạo vai trò là một UI để vô tình
    // tạo ra vai trò có rbac:manage.
    const res = await (method === 'POST'
      ? sysAgent.post(path).send({})
      : sysAgent.delete(path));

    expect(res.status).toBe(403);
  });
});
