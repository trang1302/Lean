import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma } from '../../src/lib/db.js';
import { createTestUser, loginAgent, type TestUser } from '../helpers/auth.js';

const app = createApp();
let alice: TestUser;
let bob: TestUser;

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.bodyLog.deleteMany();
  await prisma.meal.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.user.deleteMany();
  alice = await createTestUser('alice@lean.local');
  bob = await createTestUser('bob@lean.local');
});

afterAll(async () => {
  await prisma.$disconnect();
});

/**
 * Suite này là lý do cả giai đoạn A tồn tại.
 *
 * Mỗi ca ở đây canh MỘT truy vấn cụ thể mà nếu quên `userId` thì không có gì
 * báo lỗi: không exception, không status lạ, không test feature nào đỏ — chỉ là
 * dữ liệu sức khỏe của người này hiện ra trong màn hình của người kia. Các test
 * feature khác đều chạy dưới đúng MỘT người dùng nên về mặt cấu trúc chúng
 * không thể bắt được lớp lỗi này.
 *
 * Ca nào ở đây đỏ thì sửa REPOSITORY, đừng sửa test.
 */
describe('cách ly người dùng — một truy vấn quên userId là rò dữ liệu sức khỏe', () => {
  it('body-logs: Alice không thấy số đo của Bob', async () => {
    await prisma.bodyLog.create({ data: { userId: bob.id, date: '2026-08-10', weightKg: 99 } });
    await prisma.bodyLog.create({ data: { userId: alice.id, date: '2026-08-10', weightKg: 60 } });

    const agent = await loginAgent(app, alice);
    const res = await agent.get('/api/body-logs/2026-08-10');

    expect(res.status).toBe(200);
    expect(res.body.weightKg).toBe(60);
  });

  it('body-logs khoảng ngày: chỉ trả hàng của người đang gọi', async () => {
    await prisma.bodyLog.create({ data: { userId: bob.id, date: '2026-08-09', weightKg: 99 } });
    await prisma.bodyLog.create({ data: { userId: alice.id, date: '2026-08-10', weightKg: 60 } });

    const agent = await loginAgent(app, alice);
    const res = await agent.get('/api/body-logs?from=2026-08-01&to=2026-08-31');

    expect(res.body).toHaveLength(1);
    expect(res.body[0].weightKg).toBe(60);
  });

  it('body-logs: Alice xóa ngày X KHÔNG chạm số đo cùng ngày của Bob', async () => {
    // `deleteMany({ where: { date } })` thiếu userId sẽ xóa cả hai hàng và vẫn
    // trả 204 cho Alice — im lặng phá dữ liệu của người khác.
    await prisma.bodyLog.create({ data: { userId: bob.id, date: '2026-08-10', weightKg: 99 } });
    await prisma.bodyLog.create({ data: { userId: alice.id, date: '2026-08-10', weightKg: 60 } });

    const agent = await loginAgent(app, alice);
    expect((await agent.delete('/api/body-logs/2026-08-10')).status).toBe(204);

    const bobRow = await prisma.bodyLog.findUnique({
      where: { userId_date: { userId: bob.id, date: '2026-08-10' } },
    });
    expect(bobRow?.weightKg).toBe(99);
  });

  it('meals: Alice không thấy bữa ăn của Bob', async () => {
    await prisma.meal.create({
      data: { userId: bob.id, date: '2026-08-10', slot: 'lunch', name: 'Cua Bob', calories: 500 },
    });

    const agent = await loginAgent(app, alice);
    const res = await agent.get('/api/meals?date=2026-08-10');

    expect(res.body).toHaveLength(0);
  });

  it('meals: Alice KHÔNG sửa được bữa ăn của Bob → 404, bản ghi không đổi', async () => {
    // 404 chứ không 403: 403 xác nhận "id này có tồn tại, chỉ không phải của
    // bạn" — một rò rỉ nhỏ nhưng đủ để dò id (rbac/SPEC.md:186).
    const bobMeal = await prisma.meal.create({
      data: { userId: bob.id, date: '2026-08-10', slot: 'lunch', name: 'Cua Bob', calories: 500 },
    });

    const agent = await loginAgent(app, alice);
    const res = await agent.patch(`/api/meals/${bobMeal.id}`).send({ calories: 1 });

    expect(res.status).toBe(404);
    const after = await prisma.meal.findUnique({ where: { id: bobMeal.id } });
    expect(after!.calories).toBe(500);
  });

  it('meals: Alice KHÔNG xóa được bữa ăn của Bob → 404, bản ghi còn nguyên', async () => {
    const bobMeal = await prisma.meal.create({
      data: { userId: bob.id, date: '2026-08-10', slot: 'lunch', name: 'Cua Bob', calories: 500 },
    });

    const agent = await loginAgent(app, alice);
    expect((await agent.delete(`/api/meals/${bobMeal.id}`)).status).toBe(404);

    expect(await prisma.meal.findUnique({ where: { id: bobMeal.id } })).not.toBeNull();
  });

  it('goal: mục tiêu của Bob không lẫn sang Alice', async () => {
    await prisma.goal.create({ data: { userId: bob.id, targetWeightKg: 99 } });

    const agent = await loginAgent(app, alice);
    const res = await agent.get('/api/goal');

    expect(res.body.targetWeightKg).toBeNull();
  });

  it('goal: Alice đặt mục tiêu KHÔNG ghi đè mục tiêu của Bob', async () => {
    await prisma.goal.create({ data: { userId: bob.id, targetWeightKg: 99 } });

    const agent = await loginAgent(app, alice);
    await agent.put('/api/goal').send({ targetWeightKg: 60 });

    const bobGoal = await prisma.goal.findUnique({ where: { userId: bob.id } });
    expect(bobGoal?.targetWeightKg).toBe(99);
  });

  it('summary: tổng calo KHÔNG gộp bữa ăn của người khác', async () => {
    // `groupBy` quên userId là chỗ dễ bỏ sót nhất của Task 8: nó không ném lỗi,
    // chỉ cộng nhầm.
    await prisma.meal.create({
      data: { userId: bob.id, date: '2026-08-10', slot: 'lunch', name: 'x', calories: 900 },
    });
    await prisma.meal.create({
      data: { userId: alice.id, date: '2026-08-10', slot: 'lunch', name: 'y', calories: 100 },
    });

    const agent = await loginAgent(app, alice);
    const res = await agent.get('/api/summary?from=2026-08-01&to=2026-08-31');

    const day = res.body.days.find((d: { date: string }) => d.date === '2026-08-10');
    expect(day.totalCalories).toBe(100);
  });

  it('summary: số đo của Bob không lọt vào chuỗi cân nặng của Alice', async () => {
    await prisma.bodyLog.create({ data: { userId: bob.id, date: '2026-08-10', weightKg: 99 } });

    const agent = await loginAgent(app, alice);
    const res = await agent.get('/api/summary?from=2026-08-01&to=2026-08-31');

    const day = res.body.days.find((d: { date: string }) => d.date === '2026-08-10');
    expect(day.weightKg).toBeNull();
  });

  it('reminders: Alice không thấy topic ntfy của Bob', async () => {
    await prisma.reminder.create({
      data: {
        userId: bob.id,
        kind: 'weigh_in',
        timeOfDay: '07:00',
        enabled: true,
        ntfyTopic: 'topic-rieng-cua-bob',
      },
    });

    const agent = await loginAgent(app, alice);
    const res = await agent.get('/api/reminders');

    expect(JSON.stringify(res.body)).not.toContain('topic-rieng-cua-bob');
  });

  it('reminders: Alice lưu cấu hình KHÔNG đè lên hàng cùng kind của Bob', async () => {
    await prisma.reminder.create({
      data: {
        userId: bob.id,
        kind: 'weigh_in',
        timeOfDay: '07:00',
        enabled: true,
        ntfyTopic: 'topic-rieng-cua-bob',
      },
    });

    const agent = await loginAgent(app, alice);
    await agent.put('/api/reminders/weigh_in').send({ timeOfDay: '09:30', ntfyTopic: 'topic-alice' });

    const bobRow = await prisma.reminder.findUnique({
      where: { userId_kind: { userId: bob.id, kind: 'weigh_in' } },
    });
    expect(bobRow?.ntfyTopic).toBe('topic-rieng-cua-bob');
    expect(bobRow?.timeOfDay).toBe('07:00');
  });
});
