import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/db.js';
import { LOCAL_USER_ID } from '../../../src/shared/constants.js';

const app = createApp();

beforeEach(async () => {
  await prisma.goal.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/goal', () => {
  it('chưa đặt mục tiêu → 200 với các trường null, KHÔNG phải 404', async () => {
    // Ngoại lệ có chủ đích so với các feature khác (spec §5): mục tiêu là một
    // singleton "luôn tồn tại về mặt khái niệm", chỉ là chưa có giá trị.
    const res = await request(app).get('/api/goal');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      targetWeightKg: null,
      targetDate: null,
      dailyCalorieTarget: null,
      updatedAt: null,
    });
  });

  it('trả đúng mục tiêu đã lưu', async () => {
    await prisma.goal.create({
      data: {
        userId: LOCAL_USER_ID,
        targetWeightKg: 68,
        targetDate: '2099-12-31',
        dailyCalorieTarget: 1900,
      },
    });

    const res = await request(app).get('/api/goal');

    expect(res.status).toBe(200);
    expect(res.body.targetWeightKg).toBe(68);
    expect(res.body.targetDate).toBe('2099-12-31');
    expect(res.body.dailyCalorieTarget).toBe(1900);
    expect(typeof res.body.updatedAt).toBe('string');
  });

  it('không thấy mục tiêu của user khác', async () => {
    await prisma.goal.create({
      data: { userId: 'someone-else', targetWeightKg: 55 },
    });

    const res = await request(app).get('/api/goal');

    expect(res.status).toBe(200);
    expect(res.body.targetWeightKg).toBeNull();
  });
});

describe('PUT /api/goal — tạo và cập nhật', () => {
  it('tạo mới khi chưa có mục tiêu', async () => {
    const res = await request(app).put('/api/goal').send({
      targetWeightKg: 68,
      targetDate: '2099-12-31',
      dailyCalorieTarget: 1900,
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      targetWeightKg: 68,
      targetDate: '2099-12-31',
      dailyCalorieTarget: 1900,
    });

    const row = await prisma.goal.findUnique({ where: { userId: LOCAL_USER_ID } });
    expect(row?.targetWeightKg).toBe(68);
  });

  it('gọi hai lần thì cập nhật, không tạo bản ghi thứ hai', async () => {
    await request(app).put('/api/goal').send({ targetWeightKg: 68 });
    const res = await request(app).put('/api/goal').send({ targetWeightKg: 65 });

    expect(res.status).toBe(200);
    expect(res.body.targetWeightKg).toBe(65);
    expect(await prisma.goal.count()).toBe(1);
  });

  it('body rỗng khi chưa có mục tiêu vẫn tạo được hàng toàn null', async () => {
    const res = await request(app).put('/api/goal').send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      targetWeightKg: null,
      targetDate: null,
      dailyCalorieTarget: null,
    });
    expect(await prisma.goal.count()).toBe(1);
  });
});

describe('PUT /api/goal — upsert ba trạng thái', () => {
  beforeEach(async () => {
    await prisma.goal.create({
      data: {
        userId: LOCAL_USER_ID,
        targetWeightKg: 68,
        targetDate: '2099-12-31',
        dailyCalorieTarget: 1900,
      },
    });
  });

  it('trường VẮNG MẶT giữ nguyên giá trị cũ', async () => {
    const res = await request(app).put('/api/goal').send({ targetWeightKg: 66 });

    expect(res.status).toBe(200);
    expect(res.body.targetWeightKg).toBe(66);
    expect(res.body.targetDate).toBe('2099-12-31');
    expect(res.body.dailyCalorieTarget).toBe(1900);
  });

  it('gửi NULL thì xóa giá trị', async () => {
    const res = await request(app).put('/api/goal').send({
      targetDate: null,
      dailyCalorieTarget: null,
    });

    expect(res.status).toBe(200);
    expect(res.body.targetWeightKg).toBe(68);
    expect(res.body.targetDate).toBeNull();
    expect(res.body.dailyCalorieTarget).toBeNull();

    const row = await prisma.goal.findUnique({ where: { userId: LOCAL_USER_ID } });
    expect(row?.targetDate).toBeNull();
    expect(row?.dailyCalorieTarget).toBeNull();
  });

  it('gửi GIÁ TRỊ thì ghi đè cả ba trường', async () => {
    const res = await request(app).put('/api/goal').send({
      targetWeightKg: 62.5,
      targetDate: '2098-01-15',
      dailyCalorieTarget: 1750,
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      targetWeightKg: 62.5,
      targetDate: '2098-01-15',
      dailyCalorieTarget: 1750,
    });
  });

  it('body rỗng không đổi gì cả', async () => {
    const res = await request(app).put('/api/goal').send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      targetWeightKg: 68,
      targetDate: '2099-12-31',
      dailyCalorieTarget: 1900,
    });
  });
});

describe('PUT /api/goal — validate', () => {
  it('targetWeightKg = 0 → 400', async () => {
    const res = await request(app).put('/api/goal').send({ targetWeightKg: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.some((f: { path: string }) => f.path === 'targetWeightKg')).toBe(
      true,
    );
  });

  it('targetWeightKg âm → 400', async () => {
    const res = await request(app).put('/api/goal').send({ targetWeightKg: -5 });
    expect(res.status).toBe(400);
  });

  it('targetWeightKg = 500 → 400 (khoảng mở, phải nhỏ hơn 500)', async () => {
    const res = await request(app).put('/api/goal').send({ targetWeightKg: 500 });
    expect(res.status).toBe(400);
  });

  it('targetDate sai định dạng → 400', async () => {
    const res = await request(app).put('/api/goal').send({ targetDate: '31/12/2099' });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.some((f: { path: string }) => f.path === 'targetDate')).toBe(true);
  });

  it('targetDate đúng định dạng nhưng không có thật → 400', async () => {
    const res = await request(app).put('/api/goal').send({ targetDate: '2099-02-30' });
    expect(res.status).toBe(400);
  });

  it('dailyCalorieTarget không phải số nguyên → 400', async () => {
    const res = await request(app).put('/api/goal').send({ dailyCalorieTarget: 1900.5 });
    expect(res.status).toBe(400);
  });

  it('targetDate ở TƯƠNG LAI được chấp nhận — khác với date của bodyLogs/meals', async () => {
    const res = await request(app).put('/api/goal').send({ targetDate: '2099-12-31' });

    expect(res.status).toBe(200);
    expect(res.body.targetDate).toBe('2099-12-31');
  });

  it('request lỗi validate không ghi gì vào DB', async () => {
    await request(app).put('/api/goal').send({ targetWeightKg: 0 });
    expect(await prisma.goal.count()).toBe(0);
  });
});
