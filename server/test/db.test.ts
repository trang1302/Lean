import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/db.js';

beforeEach(async () => {
  await prisma.meal.deleteMany();
  await prisma.bodyLog.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.reminder.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('BodyLog', () => {
  it('date là unique — không tạo được hai bản ghi cùng ngày', async () => {
    await prisma.bodyLog.create({ data: { date: '2026-08-06', weightKg: 72.4 } });
    await expect(
      prisma.bodyLog.create({ data: { date: '2026-08-06', weightKg: 72.5 } }),
    ).rejects.toThrow();
  });

  it('weightKg và waistCm đều nullable', async () => {
    const row = await prisma.bodyLog.create({ data: { date: '2026-08-06' } });
    expect(row.weightKg).toBeNull();
    expect(row.waistCm).toBeNull();
  });
});

describe('Meal', () => {
  it('cho phép nhiều bữa trong cùng một ngày', async () => {
    await prisma.meal.create({
      data: { date: '2026-08-06', slot: 'breakfast', name: 'Phở', calories: 450 },
    });
    await prisma.meal.create({
      data: { date: '2026-08-06', slot: 'lunch', name: 'Cơm tấm', calories: 700 },
    });
    expect(await prisma.meal.count({ where: { date: '2026-08-06' } })).toBe(2);
  });
});

describe('Reminder', () => {
  it('kind là unique', async () => {
    await prisma.reminder.create({ data: { kind: 'weigh_in', timeOfDay: '07:00' } });
    await expect(
      prisma.reminder.create({ data: { kind: 'weigh_in', timeOfDay: '08:00' } }),
    ).rejects.toThrow();
  });
});
