import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/db.js';
import { createTestUser, loginAgent, type Agent, type TestUser } from '../../helpers/auth.js';

const app = createApp();

// Người dùng thật + agent đã đăng nhập, dựng lại ở mỗi test.
// `otherUser` là chủ sở hữu của những bản ghi mà test cách ly dùng để chứng
// minh dữ liệu không rò sang người đang gọi API.
let user: TestUser;
let otherUser: TestUser;
let agent: Agent;

beforeEach(async () => {
  await prisma.reminder.deleteMany();
  await prisma.bodyLog.deleteMany();
  await prisma.meal.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  user = await createTestUser('alice@lean.local');
  otherUser = await createTestUser('bob@lean.local');
  agent = await loginAgent(app, user);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/reminders', () => {
  it('DB rỗng vẫn trả đủ hai loại nhắc nhở ở trạng thái mặc định', async () => {
    const res = await agent.get('/api/reminders');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.map((r: { kind: string }) => r.kind)).toEqual(['weigh_in', 'meal_log']);
    expect(res.body[0]).toEqual({
      kind: 'weigh_in',
      timeOfDay: expect.stringMatching(/^([01]\d|2[0-3]):[0-5]\d$/),
      enabled: false,
      ntfyTopic: null,
    });
  });

  it('trả giá trị đã lưu trong DB', async () => {
    await prisma.reminder.create({
      data: {
        userId: user.id,
        kind: 'weigh_in',
        timeOfDay: '06:30',
        enabled: true,
        ntfyTopic: 'lean-test',
      },
    });

    const res = await agent.get('/api/reminders');

    expect(res.status).toBe(200);
    expect(res.body).toContainEqual({
      kind: 'weigh_in',
      timeOfDay: '06:30',
      enabled: true,
      ntfyTopic: 'lean-test',
    });
  });

  it('không trả nhắc nhở của người dùng khác', async () => {
    await prisma.reminder.create({
      data: {
        userId: otherUser.id,
        kind: 'weigh_in',
        timeOfDay: '23:00',
        enabled: true,
        ntfyTopic: 'not-mine',
      },
    });

    const res = await agent.get('/api/reminders');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const weighIn = res.body.find((r: { kind: string }) => r.kind === 'weigh_in');
    expect(weighIn.ntfyTopic).toBeNull();
    expect(weighIn.enabled).toBe(false);
  });
});

describe('PUT /api/reminders/:kind', () => {
  it('cập nhật được khi chưa có bản ghi (upsert)', async () => {
    const res = await agent
      .put('/api/reminders/weigh_in')
      .send({ timeOfDay: '07:15', enabled: true, ntfyTopic: 'lean-abc' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      kind: 'weigh_in',
      timeOfDay: '07:15',
      enabled: true,
      ntfyTopic: 'lean-abc',
    });

    const row = await prisma.reminder.findUnique({
      where: { userId_kind: { userId: user.id, kind: 'weigh_in' } },
    });
    expect(row?.timeOfDay).toBe('07:15');
    expect(row?.enabled).toBe(true);
  });

  it('gọi hai lần chỉ sinh một bản ghi', async () => {
    await agent.put('/api/reminders/meal_log').send({ timeOfDay: '20:00' });
    await agent.put('/api/reminders/meal_log').send({ timeOfDay: '21:00' });

    expect(await prisma.reminder.count({ where: { kind: 'meal_log' } })).toBe(1);
    const row = await prisma.reminder.findUnique({
      where: { userId_kind: { userId: user.id, kind: 'meal_log' } },
    });
    expect(row?.timeOfDay).toBe('21:00');
  });

  it('trường vắng mặt giữ nguyên giá trị cũ', async () => {
    await agent
      .put('/api/reminders/weigh_in')
      .send({ timeOfDay: '06:00', enabled: true, ntfyTopic: 'giu-nguyen' });

    const res = await agent.put('/api/reminders/weigh_in').send({ enabled: false });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      kind: 'weigh_in',
      timeOfDay: '06:00',
      enabled: false,
      ntfyTopic: 'giu-nguyen',
    });
  });

  it('gửi ntfyTopic = null thì xóa topic', async () => {
    await agent
      .put('/api/reminders/weigh_in')
      .send({ timeOfDay: '06:00', enabled: true, ntfyTopic: 'se-bi-xoa' });

    const res = await agent.put('/api/reminders/weigh_in').send({ ntfyTopic: null });

    expect(res.status).toBe(200);
    expect(res.body.ntfyTopic).toBeNull();
  });

  it('kind không tồn tại → 404', async () => {
    const res = await agent.put('/api/reminders/khong_co_that').send({ enabled: true });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(await prisma.reminder.count()).toBe(0);
  });

  it.each(['24:00', '7:00', '07:60', '0700', '', 'ab:cd'])(
    'timeOfDay sai định dạng (%s) → 400',
    async (bad) => {
      const res = await agent.put('/api/reminders/weigh_in').send({ timeOfDay: bad });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.fields.some((f: { path: string }) => f.path === 'timeOfDay')).toBe(
        true,
      );
      expect(await prisma.reminder.count()).toBe(0);
    },
  );

  it('timeOfDay hợp lệ ở hai biên 00:00 và 23:59', async () => {
    const first = await agent.put('/api/reminders/weigh_in').send({ timeOfDay: '00:00' });
    const second = await agent.put('/api/reminders/meal_log').send({ timeOfDay: '23:59' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });

  it('enabled sai kiểu → 400', async () => {
    const res = await agent.put('/api/reminders/weigh_in').send({ enabled: 'yes' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('trường lạ trong body → 400', async () => {
    const res = await agent.put('/api/reminders/weigh_in').send({ timeOfDayy: '07:00' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
