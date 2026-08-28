import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/lib/db.js';
import { createTestUser, type TestUser } from '../helpers/auth.js';

// Test này nói về RÀNG BUỘC của schema (khóa chính kép, khóa ngoại, unique),
// không nói về HTTP — nên nó dựng user thẳng bằng Prisma, không cần đăng nhập.
let user: TestUser;
let otherUser: TestUser;

beforeEach(async () => {
  await prisma.meal.deleteMany();
  await prisma.bodyLog.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  user = await createTestUser('alice@lean.local');
  otherUser = await createTestUser('bob@lean.local');
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('BodyLog', () => {
  it('cùng user + cùng ngày là trùng khóa — không tạo được hai bản ghi', async () => {
    await prisma.bodyLog.create({
      data: { userId: user.id, date: '2026-08-06', weightKg: 72.4 },
    });
    await expect(
      prisma.bodyLog.create({
        data: { userId: user.id, date: '2026-08-06', weightKg: 72.5 },
      }),
    ).rejects.toThrow();
  });

  it('hai user khác nhau ghi cùng một ngày thì không đụng nhau', async () => {
    // Đây là lý do userId có mặt từ đầu: khóa là (userId, date), không phải date.
    await prisma.bodyLog.create({
      data: { userId: user.id, date: '2026-08-06', weightKg: 72.4 },
    });
    await prisma.bodyLog.create({
      data: { userId: otherUser.id, date: '2026-08-06', weightKg: 60.1 },
    });
    expect(await prisma.bodyLog.count({ where: { date: '2026-08-06' } })).toBe(2);
  });

  it('weightKg và waistCm đều nullable', async () => {
    const row = await prisma.bodyLog.create({
      data: { userId: user.id, date: '2026-08-06' },
    });
    expect(row.weightKg).toBeNull();
    expect(row.waistCm).toBeNull();
  });
});

describe('Meal', () => {
  it('cho phép nhiều bữa trong cùng một ngày', async () => {
    await prisma.meal.create({
      data: {
        userId: user.id,
        date: '2026-08-06',
        slot: 'breakfast',
        name: 'Phở',
        calories: 450,
      },
    });
    await prisma.meal.create({
      data: {
        userId: user.id,
        date: '2026-08-06',
        slot: 'lunch',
        name: 'Cơm tấm',
        calories: 700,
      },
    });
    expect(
      await prisma.meal.count({ where: { userId: user.id, date: '2026-08-06' } }),
    ).toBe(2);
  });
});

describe('Goal', () => {
  it('mỗi user có đúng một mục tiêu — userId là khóa chính', async () => {
    await prisma.goal.create({ data: { userId: user.id, targetWeightKg: 68 } });
    await expect(
      prisma.goal.create({ data: { userId: user.id, targetWeightKg: 70 } }),
    ).rejects.toThrow();
  });
});

describe('Reminder', () => {
  it('(userId, kind) là unique', async () => {
    await prisma.reminder.create({
      data: { userId: user.id, kind: 'weigh_in', timeOfDay: '07:00' },
    });
    await expect(
      prisma.reminder.create({
        data: { userId: user.id, kind: 'weigh_in', timeOfDay: '08:00' },
      }),
    ).rejects.toThrow();
  });

  it('hai user cùng đặt nhắc nhở weigh_in thì không đụng nhau', async () => {
    await prisma.reminder.create({
      data: { userId: user.id, kind: 'weigh_in', timeOfDay: '07:00' },
    });
    await prisma.reminder.create({
      data: { userId: otherUser.id, kind: 'weigh_in', timeOfDay: '09:00' },
    });
    expect(await prisma.reminder.count({ where: { kind: 'weigh_in' } })).toBe(2);
  });
});
