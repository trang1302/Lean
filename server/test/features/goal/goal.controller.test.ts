import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/db.js';
import { createTestUser, loginAgent, type Agent, type TestUser } from '../../helpers/auth.js';
import { addDays, todayIso } from '../../../src/lib/time.js';

const app = createApp();

// Người dùng thật + agent đã đăng nhập, dựng lại ở mỗi test.
// `otherUser` là chủ sở hữu của những bản ghi mà test cách ly dùng để chứng
// minh dữ liệu không rò sang người đang gọi API.
let user: TestUser;
let otherUser: TestUser;
let agent: Agent;
const TODAY = todayIso();
const TWO_DAYS_AGO = addDays(TODAY, -2);
const TOMORROW = addDays(TODAY, 1);

beforeEach(async () => {
  await prisma.goal.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  user = await createTestUser('alice@lean.local');
  otherUser = await createTestUser('bob@lean.local');
  agent = await loginAgent(app, user);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/goal', () => {
  it('chưa đặt mục tiêu → 200 với các trường null, KHÔNG phải 404', async () => {
    // Ngoại lệ có chủ đích so với các feature khác (spec §5): mục tiêu là một
    // singleton "luôn tồn tại về mặt khái niệm", chỉ là chưa có giá trị.
    const res = await agent.get('/api/goal');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      startWeightKg: null,
      startDate: null,
      targetWeightKg: null,
      targetWaistCm: null,
      targetChestCm: null,
      targetShoulderCm: null,
      targetArmCm: null,
      targetDate: null,
      dailyCalorieTarget: null,
      updatedAt: null,
    });
  });

  it('trả đúng mục tiêu đã lưu', async () => {
    await prisma.goal.create({
      data: {
        userId: user.id,
        targetWeightKg: 68,
        targetDate: '2099-12-31',
        dailyCalorieTarget: 1900,
      },
    });

    const res = await agent.get('/api/goal');

    expect(res.status).toBe(200);
    expect(res.body.targetWeightKg).toBe(68);
    expect(res.body.targetDate).toBe('2099-12-31');
    expect(res.body.dailyCalorieTarget).toBe(1900);
    expect(typeof res.body.updatedAt).toBe('string');
  });

  it('không thấy mục tiêu của user khác', async () => {
    await prisma.goal.create({
      data: { userId: otherUser.id, targetWeightKg: 55 },
    });

    const res = await agent.get('/api/goal');

    expect(res.status).toBe(200);
    expect(res.body.targetWeightKg).toBeNull();
  });
});

describe('PUT /api/goal — tạo và cập nhật', () => {
  it('tạo mới khi chưa có mục tiêu', async () => {
    const res = await agent.put('/api/goal').send({
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

    const row = await prisma.goal.findUnique({ where: { userId: user.id } });
    expect(row?.targetWeightKg).toBe(68);
  });

  it('gọi hai lần thì cập nhật, không tạo bản ghi thứ hai', async () => {
    await agent.put('/api/goal').send({ targetWeightKg: 68 });
    const res = await agent.put('/api/goal').send({ targetWeightKg: 65 });

    expect(res.status).toBe(200);
    expect(res.body.targetWeightKg).toBe(65);
    expect(await prisma.goal.count()).toBe(1);
  });

  it('body rỗng khi chưa có mục tiêu vẫn tạo được hàng toàn null', async () => {
    const res = await agent.put('/api/goal').send({});

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
        userId: user.id,
        targetWeightKg: 68,
        targetDate: '2099-12-31',
        dailyCalorieTarget: 1900,
      },
    });
  });

  it('trường VẮNG MẶT giữ nguyên giá trị cũ', async () => {
    const res = await agent.put('/api/goal').send({ targetWeightKg: 66 });

    expect(res.status).toBe(200);
    expect(res.body.targetWeightKg).toBe(66);
    expect(res.body.targetDate).toBe('2099-12-31');
    expect(res.body.dailyCalorieTarget).toBe(1900);
  });

  it('gửi NULL thì xóa giá trị', async () => {
    const res = await agent.put('/api/goal').send({
      targetDate: null,
      dailyCalorieTarget: null,
    });

    expect(res.status).toBe(200);
    expect(res.body.targetWeightKg).toBe(68);
    expect(res.body.targetDate).toBeNull();
    expect(res.body.dailyCalorieTarget).toBeNull();

    const row = await prisma.goal.findUnique({ where: { userId: user.id } });
    expect(row?.targetDate).toBeNull();
    expect(row?.dailyCalorieTarget).toBeNull();
  });

  it('gửi GIÁ TRỊ thì ghi đè cả ba trường', async () => {
    const res = await agent.put('/api/goal').send({
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
    const res = await agent.put('/api/goal').send({});

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
    const res = await agent.put('/api/goal').send({ targetWeightKg: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.some((f: { path: string }) => f.path === 'targetWeightKg')).toBe(
      true,
    );
  });

  it('targetWeightKg âm → 400', async () => {
    const res = await agent.put('/api/goal').send({ targetWeightKg: -5 });
    expect(res.status).toBe(400);
  });

  it('targetWeightKg = 500 → 400 (khoảng mở, phải nhỏ hơn 500)', async () => {
    const res = await agent.put('/api/goal').send({ targetWeightKg: 500 });
    expect(res.status).toBe(400);
  });

  it('targetDate sai định dạng → 400', async () => {
    const res = await agent.put('/api/goal').send({ targetDate: '31/12/2099' });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.some((f: { path: string }) => f.path === 'targetDate')).toBe(true);
  });

  it('targetDate đúng định dạng nhưng không có thật → 400', async () => {
    const res = await agent.put('/api/goal').send({ targetDate: '2099-02-30' });
    expect(res.status).toBe(400);
  });

  it('dailyCalorieTarget không phải số nguyên → 400', async () => {
    const res = await agent.put('/api/goal').send({ dailyCalorieTarget: 1900.5 });
    expect(res.status).toBe(400);
  });

  it('targetDate ở TƯƠNG LAI được chấp nhận — khác với date của bodyLogs/meals', async () => {
    const res = await agent.put('/api/goal').send({ targetDate: '2099-12-31' });

    expect(res.status).toBe(200);
    expect(res.body.targetDate).toBe('2099-12-31');
  });

  it('request lỗi validate không ghi gì vào DB', async () => {
    await agent.put('/api/goal').send({ targetWeightKg: 0 });
    expect(await prisma.goal.count()).toBe(0);
  });
});

describe('PUT /api/goal — 9 trường, không trường nào bị strip im lặng', () => {
  const FULL_GOAL = {
    startWeightKg: 75,
    startDate: TWO_DAYS_AGO,
    targetWeightKg: 68,
    targetWaistCm: 80,
    targetChestCm: 95,
    targetShoulderCm: 110,
    targetArmCm: 30,
    targetDate: '2027-01-01',
    dailyCalorieTarget: 1800,
  } as const;

  it('gửi cả 9 trường thì đọc lại đủ 9', async () => {
    const put = await agent.put('/api/goal').send(FULL_GOAL);
    expect(put.status).toBe(200);

    const get = await agent.get('/api/goal');
    expect(get.status).toBe(200);
    expect(get.body).toMatchObject(FULL_GOAL);
  });

  it('gửi một trường không đụng tám trường kia', async () => {
    await agent.put('/api/goal').send(FULL_GOAL);

    await agent.put('/api/goal').send({ targetArmCm: 28 });

    const get = await agent.get('/api/goal');
    expect(get.body.targetArmCm).toBe(28);
    expect(get.body).toMatchObject({ ...FULL_GOAL, targetArmCm: 28 });
  });

  it('gửi null xoá đúng một trường', async () => {
    await agent.put('/api/goal').send(FULL_GOAL);

    await agent.put('/api/goal').send({ startWeightKg: null });

    const get = await agent.get('/api/goal');
    expect(get.body.startWeightKg).toBeNull();
    expect(get.body.startDate).toBe(TWO_DAYS_AGO);
  });

  // startDate là mốc ĐÃ XẢY RA (điểm xuất phát), ngược hẳn targetDate là mốc
  // TƯƠNG LAI. Hai trường ngày, hai schema khác nhau — đây là chỗ dễ chép nhầm.
  it('startDate ở tương lai → 400', async () => {
    const res = await agent.put('/api/goal').send({ startDate: TOMORROW });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('startDate');
  });

  it('startDate sai định dạng → 400', async () => {
    const res = await agent.put('/api/goal').send({ startDate: '01-01-2026' });

    expect(res.status).toBe(400);
  });

  it('targetDate ở tương lai vẫn hợp lệ', async () => {
    const res = await agent.put('/api/goal').send({ targetDate: '2030-06-01' });

    expect(res.status).toBe(200);
  });
});

describe('GET /api/goal — chưa đặt gì trả 9 trường null', () => {
  it('không 404, mọi trường null', async () => {
    const res = await agent.get('/api/goal');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      startWeightKg: null,
      startDate: null,
      targetWeightKg: null,
      targetWaistCm: null,
      targetChestCm: null,
      targetShoulderCm: null,
      targetArmCm: null,
      targetDate: null,
      dailyCalorieTarget: null,
      updatedAt: null,
    });
  });
});
