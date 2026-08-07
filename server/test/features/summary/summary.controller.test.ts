import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app.js';
import { prisma } from '../../../src/lib/db.js';
import { LOCAL_USER_ID } from '../../../src/shared/constants.js';
import { addDays, todayIso } from '../../../src/lib/time.js';

const app = createApp();

/**
 * Mọi fixture neo vào `todayIso()` chứ không dùng ngày cứng: khối `goal` của
 * `/api/summary` neo vào HÔM NAY, nên test dùng ngày cứng sẽ hỏng khi lịch trôi.
 */
const TODAY = todayIso();
const dayAgo = (n: number): string => addDays(TODAY, -n);

async function seedBodyLog(
  date: string,
  values: { weightKg?: number; waistCm?: number },
): Promise<void> {
  await prisma.bodyLog.create({
    data: {
      userId: LOCAL_USER_ID,
      date,
      weightKg: values.weightKg ?? null,
      waistCm: values.waistCm ?? null,
    },
  });
}

async function seedMeal(date: string, name: string, calories: number): Promise<void> {
  await prisma.meal.create({
    data: { userId: LOCAL_USER_ID, date, slot: 'lunch', name, calories },
  });
}

beforeEach(async () => {
  await prisma.meal.deleteMany();
  await prisma.bodyLog.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.reminder.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/summary — hình dạng response', () => {
  it('trả đủ ba khối days, weeks, goal', async () => {
    const res = await request(app)
      .get('/api/summary')
      .query({ from: dayAgo(60), to: dayAgo(58) });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('days');
    expect(res.body).toHaveProperty('weeks');
    expect(res.body).toHaveProperty('goal');
    expect(Array.isArray(res.body.days)).toBe(true);
    expect(Array.isArray(res.body.weeks)).toBe(true);
  });

  it('mỗi phần tử days có đủ 7 trường theo §5', async () => {
    await seedBodyLog(dayAgo(60), { weightKg: 72.4, waistCm: 88 });

    const res = await request(app)
      .get('/api/summary')
      .query({ from: dayAgo(60), to: dayAgo(60) });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.days[0]).sort()).toEqual(
      [
        'date',
        'mealCount',
        'totalCalories',
        'waistCm',
        'waistMa7',
        'weightKg',
        'weightMa7',
      ].sort(),
    );
  });

  it('khối goal có đủ 8 trường theo §5', async () => {
    const res = await request(app)
      .get('/api/summary')
      .query({ from: dayAgo(60), to: dayAgo(58) });

    expect(Object.keys(res.body.goal).sort()).toEqual(
      [
        'currentMa7WeightKg',
        'currentRateKgPerWeek',
        'dailyCalorieTarget',
        'onTrack',
        'remainingKg',
        'requiredRateKgPerWeek',
        'targetDate',
        'targetWeightKg',
      ].sort(),
    );
  });
});

describe('GET /api/summary — days', () => {
  it('có đúng một phần tử cho mỗi ngày lịch trong khoảng, kể cả ngày trống', async () => {
    const res = await request(app)
      .get('/api/summary')
      .query({ from: dayAgo(60), to: dayAgo(56) });

    expect(res.status).toBe(200);
    expect(res.body.days.map((d: { date: string }) => d.date)).toEqual([
      dayAgo(60),
      dayAgo(59),
      dayAgo(58),
      dayAgo(57),
      dayAgo(56),
    ]);
  });

  it('trả số đo thô đúng ngày, null ở ngày không ghi', async () => {
    await seedBodyLog(dayAgo(59), { weightKg: 72.4, waistCm: 88 });

    const res = await request(app)
      .get('/api/summary')
      .query({ from: dayAgo(60), to: dayAgo(59) });

    expect(res.body.days[0]).toMatchObject({ weightKg: null, waistCm: null });
    expect(res.body.days[1]).toMatchObject({ weightKg: 72.4, waistCm: 88 });
  });

  it('weightMa7 là null khi cửa sổ có dưới 2 giá trị', async () => {
    // Một số đo duy nhất trong toàn bộ lịch sử — mọi cửa sổ đều có ≤ 1 giá trị.
    await seedBodyLog(dayAgo(59), { weightKg: 71 });

    const res = await request(app)
      .get('/api/summary')
      .query({ from: dayAgo(60), to: dayAgo(58) });

    expect(res.body.days.map((d: { weightMa7: number | null }) => d.weightMa7)).toEqual([
      null,
      null,
      null,
    ]);
  });

  it('MA7 của ngày `from` PHẢI tính cả dữ liệu trước `from`', async () => {
    // Cửa sổ MA7 của ngày `from` là [from-6, from]. Nếu repository chỉ query
    // `date >= from` thì hai điểm dưới đây bị bỏ sót và MA7 ra null oan.
    await seedBodyLog(dayAgo(62), { weightKg: 70, waistCm: 90 });
    await seedBodyLog(dayAgo(61), { weightKg: 72, waistCm: 92 });
    await seedBodyLog(dayAgo(60), { weightKg: 74, waistCm: 94 });

    const res = await request(app)
      .get('/api/summary')
      .query({ from: dayAgo(60), to: dayAgo(60) });

    expect(res.status).toBe(200);
    expect(res.body.days).toHaveLength(1);
    // (70 + 72 + 74) / 3 = 72 — không phải null, và không phải 74.
    expect(res.body.days[0].weightMa7).toBeCloseTo(72, 10);
    expect(res.body.days[0].waistMa7).toBeCloseTo(92, 10);
  });

  it('totalCalories và mealCount cộng đúng theo ngày', async () => {
    await seedMeal(dayAgo(59), 'Phở', 450);
    await seedMeal(dayAgo(59), 'Cơm tấm', 700);
    await seedMeal(dayAgo(58), 'Bún bò', 600);

    const res = await request(app)
      .get('/api/summary')
      .query({ from: dayAgo(59), to: dayAgo(58) });

    expect(res.body.days[0]).toMatchObject({ totalCalories: 1150, mealCount: 2 });
    expect(res.body.days[1]).toMatchObject({ totalCalories: 600, mealCount: 1 });
  });

  it('ngày không ghi bữa nào có totalCalories 0 và mealCount 0', async () => {
    await seedMeal(dayAgo(59), 'Phở', 450);

    const res = await request(app)
      .get('/api/summary')
      .query({ from: dayAgo(60), to: dayAgo(59) });

    expect(res.body.days[0]).toMatchObject({ totalCalories: 0, mealCount: 0 });
    expect(res.body.days[1]).toMatchObject({ totalCalories: 450, mealCount: 1 });
  });
});

describe('GET /api/summary — weeks', () => {
  it('gộp theo tuần bắt đầu thứ Hai; avgCalories bỏ qua ngày không ghi bữa', async () => {
    // 2026-03-02 là thứ Hai, 2026-03-08 là Chủ nhật — trọn một tuần.
    await seedMeal('2026-03-02', 'Phở', 1000);
    await seedMeal('2026-03-04', 'Bún', 2000);
    await seedBodyLog('2026-03-02', { weightKg: 72 });
    await seedBodyLog('2026-03-04', { weightKg: 74 });

    const res = await request(app)
      .get('/api/summary')
      .query({ from: '2026-03-02', to: '2026-03-08' });

    expect(res.status).toBe(200);
    expect(res.body.weeks).toHaveLength(1);
    // 5 ngày không ghi bữa KHÔNG bị tính là 0 calo: (1000 + 2000) / 2 = 1500.
    expect(res.body.weeks[0]).toMatchObject({ weekStart: '2026-03-02' });
    expect(res.body.weeks[0].avgCalories).toBeCloseTo(1500, 10);
    expect(res.body.weeks[0].avgWeightKg).toBeCloseTo(73, 10);
  });

  it('tuần không có dữ liệu vẫn xuất hiện với avg null', async () => {
    const res = await request(app)
      .get('/api/summary')
      .query({ from: '2026-03-02', to: '2026-03-08' });

    expect(res.body.weeks).toEqual([
      { weekStart: '2026-03-02', avgCalories: null, avgWeightKg: null },
    ]);
  });
});

describe('GET /api/summary — goal', () => {
  it('toàn null khi chưa đặt mục tiêu và chưa có số đo gần đây', async () => {
    await seedBodyLog(dayAgo(60), { weightKg: 72 });

    const res = await request(app)
      .get('/api/summary')
      .query({ from: dayAgo(60), to: dayAgo(58) });

    expect(res.body.goal).toEqual({
      targetWeightKg: null,
      targetDate: null,
      dailyCalorieTarget: null,
      currentMa7WeightKg: null,
      remainingKg: null,
      currentRateKgPerWeek: null,
      requiredRateKgPerWeek: null,
      onTrack: null,
    });
  });

  it('các trường phụ thuộc mục tiêu là null khi chưa đặt mục tiêu, dù có số đo', async () => {
    await seedBodyLog(dayAgo(1), { weightKg: 73 });
    await seedBodyLog(TODAY, { weightKg: 73 });

    const res = await request(app).get('/api/summary').query({ from: dayAgo(2), to: TODAY });

    expect(res.body.goal.currentMa7WeightKg).toBeCloseTo(73, 10);
    expect(res.body.goal.targetWeightKg).toBeNull();
    expect(res.body.goal.targetDate).toBeNull();
    expect(res.body.goal.dailyCalorieTarget).toBeNull();
    expect(res.body.goal.remainingKg).toBeNull();
    expect(res.body.goal.requiredRateKgPerWeek).toBeNull();
    expect(res.body.goal.onTrack).toBeNull();
  });

  it('neo vào HÔM NAY, không neo vào `to`, và lấy đủ dữ liệu tới today-20', async () => {
    // currentRate cần MA7 của 14 ngày trước — cửa sổ [today-20, today-14].
    // Khoảng truy vấn dưới đây chỉ là [today-2, today], nên nếu repository lấy
    // dữ liệu theo `from - 6` thôi thì hai điểm 14/15 ngày trước sẽ bị bỏ sót.
    await seedBodyLog(dayAgo(15), { weightKg: 74 });
    await seedBodyLog(dayAgo(14), { weightKg: 74 });
    await seedBodyLog(dayAgo(1), { weightKg: 73 });
    await seedBodyLog(TODAY, { weightKg: 73 });
    await prisma.goal.create({
      data: {
        userId: LOCAL_USER_ID,
        targetWeightKg: 68,
        targetDate: addDays(TODAY, 14),
        dailyCalorieTarget: 1900,
      },
    });

    const res = await request(app).get('/api/summary').query({ from: dayAgo(2), to: TODAY });

    expect(res.status).toBe(200);
    expect(res.body.goal.targetWeightKg).toBe(68);
    expect(res.body.goal.targetDate).toBe(addDays(TODAY, 14));
    expect(res.body.goal.dailyCalorieTarget).toBe(1900);
    expect(res.body.goal.currentMa7WeightKg).toBeCloseTo(73, 10);
    // (73 - 74) / 2 = -0.5 kg/tuần
    expect(res.body.goal.currentRateKgPerWeek).toBeCloseTo(-0.5, 10);
    // (68 - 73) / (14 / 7) = -2.5 kg/tuần
    expect(res.body.goal.requiredRateKgPerWeek).toBeCloseTo(-2.5, 10);
    expect(res.body.goal.remainingKg).toBeCloseTo(5, 10);
    // Cần giảm 2.5 kg/tuần mà mới giảm 0.5 → chưa đúng tiến độ.
    expect(res.body.goal.onTrack).toBe(false);
  });

  it('vẫn tính đúng khi khoảng truy vấn nằm hoàn toàn trong quá khứ', async () => {
    // `to` ở quá khứ nhưng goal neo vào hôm nay → vẫn phải thấy số đo hôm nay.
    await seedBodyLog(dayAgo(1), { weightKg: 70 });
    await seedBodyLog(TODAY, { weightKg: 70 });
    await prisma.goal.create({
      data: { userId: LOCAL_USER_ID, targetWeightKg: 70, targetDate: addDays(TODAY, 7) },
    });

    const res = await request(app)
      .get('/api/summary')
      .query({ from: dayAgo(60), to: dayAgo(58) });

    expect(res.body.goal.currentMa7WeightKg).toBeCloseTo(70, 10);
    expect(res.body.goal.remainingKg).toBeCloseTo(0, 10);
  });
});

describe('GET /api/summary — validate', () => {
  it('400 khi from > to', async () => {
    const res = await request(app)
      .get('/api/summary')
      .query({ from: '2026-03-10', to: '2026-03-01' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('from');
  });

  it('400 khi khoảng vượt quá 730 ngày', async () => {
    const res = await request(app)
      .get('/api/summary')
      .query({ from: addDays(TODAY, -800), to: TODAY });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.map((f: { path: string }) => f.path)).toContain('to');
  });

  it('400 khi thiếu from', async () => {
    const res = await request(app).get('/api/summary').query({ to: TODAY });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400 khi thiếu to', async () => {
    const res = await request(app).get('/api/summary').query({ from: TODAY });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400 khi from không phải ngày có thật', async () => {
    const res = await request(app)
      .get('/api/summary')
      .query({ from: '2026-02-30', to: '2026-03-01' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
