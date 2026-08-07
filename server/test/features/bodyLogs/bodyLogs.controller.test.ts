import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/db.js';
import { LOCAL_USER_ID } from '../../../src/shared/constants.js';
import { addDays, todayIso } from '../../../src/lib/time.js';

const app = createApp();

const OTHER_USER = 'someone-else';

// Ngày neo theo "hôm nay" của TZ chứ không hardcode: `pastOrTodayDateString`
// từ chối ngày tương lai, nên một chuỗi cố định sẽ hỏng khi lịch chạy qua nó.
const TODAY = todayIso();
const YESTERDAY = addDays(TODAY, -1);
const TWO_DAYS_AGO = addDays(TODAY, -2);
const FIVE_DAYS_AGO = addDays(TODAY, -5);
const TOMORROW = addDays(TODAY, 1);

beforeEach(async () => {
  await prisma.meal.deleteMany();
  await prisma.bodyLog.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.reminder.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/body-logs/:date', () => {
  it('trả số đo của ngày đã ghi', async () => {
    await prisma.bodyLog.create({
      data: { userId: LOCAL_USER_ID, date: YESTERDAY, weightKg: 72.4, waistCm: 88, note: 'ổn' },
    });

    const res = await request(app).get(`/api/body-logs/${YESTERDAY}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      date: YESTERDAY,
      weightKg: 72.4,
      waistCm: 88,
      note: 'ổn',
    });
  });

  it('không rò rỉ userId ra response', async () => {
    await prisma.bodyLog.create({
      data: { userId: LOCAL_USER_ID, date: YESTERDAY, weightKg: 72.4 },
    });

    const res = await request(app).get(`/api/body-logs/${YESTERDAY}`);

    expect(res.body).not.toHaveProperty('userId');
  });

  it('404 khi ngày đó chưa ghi gì', async () => {
    const res = await request(app).get(`/api/body-logs/${YESTERDAY}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('không thấy bản ghi của user khác', async () => {
    await prisma.bodyLog.create({
      data: { userId: OTHER_USER, date: YESTERDAY, weightKg: 60.1 },
    });

    const res = await request(app).get(`/api/body-logs/${YESTERDAY}`);

    expect(res.status).toBe(404);
  });

  it('400 khi date sai định dạng', async () => {
    const res = await request(app).get('/api/body-logs/06-08-2026');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'date' })]),
    );
  });

  it('400 khi date không có thật', async () => {
    const res = await request(app).get('/api/body-logs/2026-02-30');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400 khi date ở tương lai', async () => {
    const res = await request(app).get(`/api/body-logs/${TOMORROW}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'date' })]),
    );
  });
});

describe('PUT /api/body-logs/:date', () => {
  it('tạo mới khi ngày đó chưa có', async () => {
    const res = await request(app)
      .put(`/api/body-logs/${YESTERDAY}`)
      .send({ weightKg: 72.4, waistCm: 88 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ date: YESTERDAY, weightKg: 72.4, waistCm: 88, note: null });

    const row = await prisma.bodyLog.findUnique({
      where: { userId_date: { userId: LOCAL_USER_ID, date: YESTERDAY } },
    });
    expect(row?.weightKg).toBe(72.4);
  });

  it('gắn LOCAL_USER_ID cho bản ghi tạo mới', async () => {
    await request(app).put(`/api/body-logs/${YESTERDAY}`).send({ weightKg: 72.4 });

    const rows = await prisma.bodyLog.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(LOCAL_USER_ID);
  });

  // Ba ca upsert — chỗ dễ regress nhất của feature này.
  it('ca 1: trường VẮNG MẶT giữ nguyên giá trị cũ', async () => {
    await prisma.bodyLog.create({
      data: { userId: LOCAL_USER_ID, date: YESTERDAY, weightKg: 72.4, waistCm: 88, note: 'cũ' },
    });

    const res = await request(app).put(`/api/body-logs/${YESTERDAY}`).send({ weightKg: 71.9 });

    expect(res.status).toBe(200);
    expect(res.body.weightKg).toBe(71.9);
    expect(res.body.waistCm).toBe(88);
    expect(res.body.note).toBe('cũ');
  });

  it('ca 2: gửi null XÓA giá trị', async () => {
    await prisma.bodyLog.create({
      data: { userId: LOCAL_USER_ID, date: YESTERDAY, weightKg: 72.4, waistCm: 88, note: 'cũ' },
    });

    const res = await request(app)
      .put(`/api/body-logs/${YESTERDAY}`)
      .send({ waistCm: null, note: null });

    expect(res.status).toBe(200);
    expect(res.body.weightKg).toBe(72.4);
    expect(res.body.waistCm).toBeNull();
    expect(res.body.note).toBeNull();
  });

  it('ca 3: gửi số ĐẶT giá trị mới', async () => {
    await prisma.bodyLog.create({
      data: { userId: LOCAL_USER_ID, date: YESTERDAY, weightKg: 72.4, waistCm: 88 },
    });

    const res = await request(app)
      .put(`/api/body-logs/${YESTERDAY}`)
      .send({ weightKg: 71.9, waistCm: 87.5 });

    expect(res.status).toBe(200);
    expect(res.body.weightKg).toBe(71.9);
    expect(res.body.waistCm).toBe(87.5);
  });

  it('body rỗng không xóa gì cả', async () => {
    await prisma.bodyLog.create({
      data: { userId: LOCAL_USER_ID, date: YESTERDAY, weightKg: 72.4, waistCm: 88, note: 'cũ' },
    });

    const res = await request(app).put(`/api/body-logs/${YESTERDAY}`).send({});

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ weightKg: 72.4, waistCm: 88, note: 'cũ' });
  });

  it('không đụng vào bản ghi cùng ngày của user khác', async () => {
    await prisma.bodyLog.create({
      data: { userId: OTHER_USER, date: YESTERDAY, weightKg: 60.1 },
    });

    await request(app).put(`/api/body-logs/${YESTERDAY}`).send({ weightKg: 72.4 });

    const other = await prisma.bodyLog.findUnique({
      where: { userId_date: { userId: OTHER_USER, date: YESTERDAY } },
    });
    expect(other?.weightKg).toBe(60.1);
    expect(await prisma.bodyLog.count()).toBe(2);
  });

  it('400 khi weightKg <= 0', async () => {
    const res = await request(app).put(`/api/body-logs/${YESTERDAY}`).send({ weightKg: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'weightKg' })]),
    );
  });

  it('400 khi weightKg >= 500', async () => {
    const res = await request(app).put(`/api/body-logs/${YESTERDAY}`).send({ weightKg: 500 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400 khi waistCm >= 300', async () => {
    const res = await request(app).put(`/api/body-logs/${YESTERDAY}`).send({ waistCm: 300 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'waistCm' })]),
    );
  });

  it('400 khi weightKg không phải số', async () => {
    const res = await request(app).put(`/api/body-logs/${YESTERDAY}`).send({ weightKg: '72.4' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400 khi date ở tương lai — không cho ghi trước', async () => {
    const res = await request(app).put(`/api/body-logs/${TOMORROW}`).send({ weightKg: 72.4 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.bodyLog.count()).toBe(0);
  });

  it('400 khi body có trường lạ', async () => {
    const res = await request(app)
      .put(`/api/body-logs/${YESTERDAY}`)
      .send({ weight: 72.4 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/body-logs/:date', () => {
  it('xóa bản ghi và trả 204', async () => {
    await prisma.bodyLog.create({
      data: { userId: LOCAL_USER_ID, date: YESTERDAY, weightKg: 72.4 },
    });

    const res = await request(app).delete(`/api/body-logs/${YESTERDAY}`);

    expect(res.status).toBe(204);
    expect(await prisma.bodyLog.count()).toBe(0);
  });

  it('404 khi ngày đó chưa ghi gì', async () => {
    const res = await request(app).delete(`/api/body-logs/${YESTERDAY}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('404 và không xóa bản ghi của user khác', async () => {
    await prisma.bodyLog.create({
      data: { userId: OTHER_USER, date: YESTERDAY, weightKg: 60.1 },
    });

    const res = await request(app).delete(`/api/body-logs/${YESTERDAY}`);

    expect(res.status).toBe(404);
    expect(await prisma.bodyLog.count()).toBe(1);
  });

  it('400 khi date sai định dạng', async () => {
    const res = await request(app).delete('/api/body-logs/khong-phai-ngay');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/body-logs?from=&to=', () => {
  it('trả danh sách sắp xếp TĂNG DẦN theo date', async () => {
    // Chèn lộn xộn để bài test thực sự kiểm tra orderBy, không phải thứ tự chèn.
    await prisma.bodyLog.createMany({
      data: [
        { userId: LOCAL_USER_ID, date: YESTERDAY, weightKg: 71.9 },
        { userId: LOCAL_USER_ID, date: FIVE_DAYS_AGO, weightKg: 73.1 },
        { userId: LOCAL_USER_ID, date: TWO_DAYS_AGO, weightKg: 72.4 },
      ],
    });

    const res = await request(app)
      .get('/api/body-logs')
      .query({ from: FIVE_DAYS_AGO, to: TODAY });

    expect(res.status).toBe(200);
    expect(res.body.map((row: { date: string }) => row.date)).toEqual([
      FIVE_DAYS_AGO,
      TWO_DAYS_AGO,
      YESTERDAY,
    ]);
  });

  it('chỉ lấy ngày nằm trong khoảng, bao gồm hai đầu mút', async () => {
    await prisma.bodyLog.createMany({
      data: [
        { userId: LOCAL_USER_ID, date: FIVE_DAYS_AGO, weightKg: 73.1 },
        { userId: LOCAL_USER_ID, date: TWO_DAYS_AGO, weightKg: 72.4 },
        { userId: LOCAL_USER_ID, date: YESTERDAY, weightKg: 71.9 },
      ],
    });

    const res = await request(app)
      .get('/api/body-logs')
      .query({ from: TWO_DAYS_AGO, to: YESTERDAY });

    expect(res.status).toBe(200);
    expect(res.body.map((row: { date: string }) => row.date)).toEqual([
      TWO_DAYS_AGO,
      YESTERDAY,
    ]);
  });

  it('bỏ qua bản ghi của user khác', async () => {
    await prisma.bodyLog.createMany({
      data: [
        { userId: OTHER_USER, date: TWO_DAYS_AGO, weightKg: 60.1 },
        { userId: LOCAL_USER_ID, date: YESTERDAY, weightKg: 71.9 },
      ],
    });

    const res = await request(app)
      .get('/api/body-logs')
      .query({ from: FIVE_DAYS_AGO, to: TODAY });

    expect(res.body).toHaveLength(1);
    expect(res.body[0].date).toBe(YESTERDAY);
  });

  it('trả mảng rỗng khi khoảng không có dữ liệu', async () => {
    const res = await request(app)
      .get('/api/body-logs')
      .query({ from: FIVE_DAYS_AGO, to: TODAY });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('400 khi thiếu from', async () => {
    const res = await request(app).get('/api/body-logs').query({ to: TODAY });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'from' })]),
    );
  });

  it('400 khi from > to', async () => {
    const res = await request(app)
      .get('/api/body-logs')
      .query({ from: YESTERDAY, to: FIVE_DAYS_AGO });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'from' })]),
    );
  });

  it('400 khi khoảng vượt quá 730 ngày', async () => {
    const res = await request(app)
      .get('/api/body-logs')
      .query({ from: addDays(TODAY, -800), to: TODAY });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'to' })]),
    );
  });
});
