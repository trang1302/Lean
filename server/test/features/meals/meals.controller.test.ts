import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/db.js';
import { LOCAL_USER_ID } from '../../../src/shared/constants.js';
import { addDays, todayIso } from '../../../src/lib/time.js';

const app = createApp();

/**
 * Ngày cố định trong quá khứ. Không dùng `todayIso()` cho dữ liệu mẫu vì
 * `pastOrTodayDateString` so với hôm nay theo Asia/Ho_Chi_Minh — một ngày cứng
 * trong quá khứ luôn hợp lệ, hôm nay thì phụ thuộc đồng hồ máy chạy test.
 */
const DAY = '2026-08-01';
const OTHER_DAY = '2026-08-02';
const OTHER_USER = 'someone-else';

beforeEach(async () => {
  await prisma.meal.deleteMany();
  await prisma.bodyLog.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.reminder.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** Tạo thẳng qua Prisma để dựng dữ liệu nền mà không đi qua API đang test. */
async function seedMeal(overrides: Partial<{
  userId: string;
  date: string;
  slot: string;
  name: string;
  calories: number;
  note: string | null;
}> = {}) {
  return prisma.meal.create({
    data: {
      userId: LOCAL_USER_ID,
      date: DAY,
      slot: 'breakfast',
      name: 'Phở',
      calories: 450,
      ...overrides,
    },
  });
}

describe('GET /api/meals', () => {
  it('trả bữa ăn của đúng ngày được hỏi', async () => {
    await seedMeal({ slot: 'breakfast', name: 'Phở', calories: 450 });
    await seedMeal({ slot: 'lunch', name: 'Cơm tấm', calories: 700 });
    await seedMeal({ date: OTHER_DAY, slot: 'dinner', name: 'Bún', calories: 500 });

    const res = await request(app).get('/api/meals').query({ date: DAY });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((meal: { name: string }) => meal.name).sort()).toEqual([
      'Cơm tấm',
      'Phở',
    ]);
  });

  it('nhiều bữa cùng ngày cùng tồn tại, không đè lên nhau', async () => {
    for (const slot of ['breakfast', 'lunch', 'dinner', 'snack']) {
      await request(app)
        .post('/api/meals')
        .send({ date: DAY, slot, name: `Món ${slot}`, calories: 300 });
    }

    const res = await request(app).get('/api/meals').query({ date: DAY });

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    const ids = new Set(res.body.map((meal: { id: string }) => meal.id));
    expect(ids.size).toBe(4);
  });

  it('trả mảng rỗng khi ngày đó chưa ghi bữa nào', async () => {
    const res = await request(app).get('/api/meals').query({ date: DAY });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('không trả bữa ăn của userId khác', async () => {
    await seedMeal({ userId: OTHER_USER, name: 'Của người khác' });

    const res = await request(app).get('/api/meals').query({ date: DAY });

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('thiếu `date` → 400 kèm trường sai', async () => {
    const res = await request(app).get('/api/meals');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('date');
  });

  it('`date` sai định dạng → 400', async () => {
    const res = await request(app).get('/api/meals').query({ date: '06-08-2026' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('date');
  });

  it('`date` là ngày không có thật → 400', async () => {
    const res = await request(app).get('/api/meals').query({ date: '2026-02-30' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/meals', () => {
  it('thêm bữa mới → 201 và bản ghi đọc lại được', async () => {
    const res = await request(app)
      .post('/api/meals')
      .send({ date: DAY, slot: 'lunch', name: 'Cơm tấm', calories: 700 });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      date: DAY,
      slot: 'lunch',
      name: 'Cơm tấm',
      calories: 700,
      note: null,
    });
    expect(typeof res.body.id).toBe('string');
    expect(res.body.id.length).toBeGreaterThan(0);
    // userId là chi tiết nội bộ, không lộ ra response.
    expect(res.body.userId).toBeUndefined();

    const stored = await prisma.meal.findUnique({ where: { id: res.body.id } });
    expect(stored?.userId).toBe(LOCAL_USER_ID);
    expect(stored?.calories).toBe(700);
  });

  it('giữ `note` khi có gửi', async () => {
    const res = await request(app)
      .post('/api/meals')
      .send({ date: DAY, slot: 'snack', name: 'Chuối', calories: 90, note: 'sau tập' });

    expect(res.status).toBe(201);
    expect(res.body.note).toBe('sau tập');
  });

  it('cắt khoảng trắng thừa ở `name`', async () => {
    const res = await request(app)
      .post('/api/meals')
      .send({ date: DAY, slot: 'dinner', name: '  Bún bò  ', calories: 600 });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Bún bò');
  });

  it('`calories` = 0 được chấp nhận (biên dưới)', async () => {
    const res = await request(app)
      .post('/api/meals')
      .send({ date: DAY, slot: 'snack', name: 'Trà không đường', calories: 0 });

    expect(res.status).toBe(201);
    expect(res.body.calories).toBe(0);
  });

  it('`calories` = 20000 được chấp nhận (biên trên)', async () => {
    const res = await request(app)
      .post('/api/meals')
      .send({ date: DAY, slot: 'dinner', name: 'Tiệc', calories: 20_000 });

    expect(res.status).toBe(201);
  });

  it('`slot` ngoài enum bị từ chối', async () => {
    const res = await request(app)
      .post('/api/meals')
      .send({ date: DAY, slot: 'brunch', name: 'Phở', calories: 450 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('slot');
    expect(await prisma.meal.count()).toBe(0);
  });

  it('`calories` âm bị từ chối', async () => {
    const res = await request(app)
      .post('/api/meals')
      .send({ date: DAY, slot: 'lunch', name: 'Phở', calories: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('calories');
  });

  it('`calories` không nguyên bị từ chối', async () => {
    const res = await request(app)
      .post('/api/meals')
      .send({ date: DAY, slot: 'lunch', name: 'Phở', calories: 450.5 });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('calories');
  });

  it('`calories` vượt 20000 bị từ chối', async () => {
    const res = await request(app)
      .post('/api/meals')
      .send({ date: DAY, slot: 'lunch', name: 'Phở', calories: 20_001 });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('calories');
  });

  it('`name` toàn khoảng trắng bị từ chối', async () => {
    const res = await request(app)
      .post('/api/meals')
      .send({ date: DAY, slot: 'lunch', name: '   ', calories: 450 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('name');
    expect(await prisma.meal.count()).toBe(0);
  });

  it('`name` rỗng bị từ chối', async () => {
    const res = await request(app)
      .post('/api/meals')
      .send({ date: DAY, slot: 'lunch', name: '', calories: 450 });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('name');
  });

  it('ngày ở tương lai bị từ chối', async () => {
    const tomorrow = addDays(todayIso(), 1);
    const res = await request(app)
      .post('/api/meals')
      .send({ date: tomorrow, slot: 'lunch', name: 'Phở', calories: 450 });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('date');
  });

  it('thiếu nhiều trường bắt buộc → liệt kê đủ trong `fields`', async () => {
    const res = await request(app).post('/api/meals').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.fields.map((f: { path: string }) => f.path);
    expect(paths).toEqual(expect.arrayContaining(['date', 'slot', 'name', 'calories']));
  });

  it('không cho client tự đặt `userId`', async () => {
    const res = await request(app)
      .post('/api/meals')
      .send({
        date: DAY,
        slot: 'lunch',
        name: 'Phở',
        calories: 450,
        userId: OTHER_USER,
      });

    expect(res.status).toBe(201);
    const stored = await prisma.meal.findUnique({ where: { id: res.body.id } });
    expect(stored?.userId).toBe(LOCAL_USER_ID);
  });
});

describe('PATCH /api/meals/:id', () => {
  it('sửa một trường, các trường khác giữ nguyên', async () => {
    const meal = await seedMeal({ name: 'Phở', calories: 450, note: 'ít bánh' });

    const res = await request(app).patch(`/api/meals/${meal.id}`).send({ calories: 500 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: meal.id,
      date: DAY,
      slot: 'breakfast',
      name: 'Phở',
      calories: 500,
      note: 'ít bánh',
    });
  });

  it('sửa được `name`, `slot`, `date` cùng lúc', async () => {
    const meal = await seedMeal();

    const res = await request(app)
      .patch(`/api/meals/${meal.id}`)
      .send({ name: 'Bún chả', slot: 'lunch', date: OTHER_DAY });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Bún chả', slot: 'lunch', date: OTHER_DAY });
    expect(res.body.calories).toBe(450);
  });

  it('gửi `note: null` thì xóa ghi chú', async () => {
    const meal = await seedMeal({ note: 'ít bánh' });

    const res = await request(app).patch(`/api/meals/${meal.id}`).send({ note: null });

    expect(res.status).toBe(200);
    expect(res.body.note).toBeNull();
  });

  it('id không tồn tại → 404', async () => {
    const res = await request(app).patch('/api/meals/khong-co-that').send({ calories: 100 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('bản ghi thuộc userId khác → 404 và KHÔNG bị sửa', async () => {
    const foreign = await seedMeal({ userId: OTHER_USER, name: 'Của người khác', calories: 111 });

    const res = await request(app)
      .patch(`/api/meals/${foreign.id}`)
      .send({ name: 'Bị chiếm', calories: 999 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');

    const stored = await prisma.meal.findUnique({ where: { id: foreign.id } });
    expect(stored?.name).toBe('Của người khác');
    expect(stored?.calories).toBe(111);
  });

  it('`slot` ngoài enum bị từ chối', async () => {
    const meal = await seedMeal();

    const res = await request(app).patch(`/api/meals/${meal.id}`).send({ slot: 'brunch' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('slot');
  });

  it('`calories` âm bị từ chối và không ghi vào DB', async () => {
    const meal = await seedMeal({ calories: 450 });

    const res = await request(app).patch(`/api/meals/${meal.id}`).send({ calories: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('calories');
    const stored = await prisma.meal.findUnique({ where: { id: meal.id } });
    expect(stored?.calories).toBe(450);
  });

  it('`calories` không nguyên bị từ chối', async () => {
    const meal = await seedMeal();

    const res = await request(app).patch(`/api/meals/${meal.id}`).send({ calories: 12.3 });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('calories');
  });

  it('`calories` vượt 20000 bị từ chối', async () => {
    const meal = await seedMeal();

    const res = await request(app).patch(`/api/meals/${meal.id}`).send({ calories: 20_001 });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('calories');
  });

  it('`name` toàn khoảng trắng bị từ chối', async () => {
    const meal = await seedMeal({ name: 'Phở' });

    const res = await request(app).patch(`/api/meals/${meal.id}`).send({ name: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('name');
    const stored = await prisma.meal.findUnique({ where: { id: meal.id } });
    expect(stored?.name).toBe('Phở');
  });

  it('`name: null` bị từ chối — chỉ `note` mới nullable', async () => {
    const meal = await seedMeal();

    const res = await request(app).patch(`/api/meals/${meal.id}`).send({ name: null });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('name');
  });

  it('ngày ở tương lai bị từ chối', async () => {
    const meal = await seedMeal();

    const res = await request(app)
      .patch(`/api/meals/${meal.id}`)
      .send({ date: addDays(todayIso(), 1) });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('date');
  });

  it('validate chạy trước khi tra id — id sai + body sai vẫn là 400', async () => {
    const res = await request(app).patch('/api/meals/khong-co-that').send({ calories: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DELETE /api/meals/:id', () => {
  it('xóa được và biến mất khỏi danh sách ngày đó', async () => {
    const keep = await seedMeal({ slot: 'lunch', name: 'Giữ lại' });
    const drop = await seedMeal({ slot: 'dinner', name: 'Xóa đi' });

    const res = await request(app).delete(`/api/meals/${drop.id}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});

    const list = await request(app).get('/api/meals').query({ date: DAY });
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(keep.id);
  });

  it('id không tồn tại → 404', async () => {
    const res = await request(app).delete('/api/meals/khong-co-that');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('xóa hai lần thì lần thứ hai là 404', async () => {
    const meal = await seedMeal();

    expect((await request(app).delete(`/api/meals/${meal.id}`)).status).toBe(204);
    expect((await request(app).delete(`/api/meals/${meal.id}`)).status).toBe(404);
  });

  it('bản ghi thuộc userId khác → 404 và KHÔNG bị xóa', async () => {
    const foreign = await seedMeal({ userId: OTHER_USER, name: 'Của người khác' });

    const res = await request(app).delete(`/api/meals/${foreign.id}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(await prisma.meal.findUnique({ where: { id: foreign.id } })).not.toBeNull();
  });
});
