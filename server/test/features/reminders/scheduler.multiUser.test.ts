import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../../src/lib/db.js';
import {
  runDueReminders,
  type ReminderRunnerDeps,
} from '../../../src/features/reminders/services/reminders.scheduler.js';
import { findRemindersForAllUsers } from '../../../src/features/reminders/repositories/reminders.repository.js';
import type { NtfyMessage, NtfySendResult } from '../../../src/shared/clients/ntfy.client.js';

let userA: string;
let userB: string;

beforeEach(async () => {
  await prisma.reminder.deleteMany();
  await prisma.bodyLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  userA = (await prisma.user.create({ data: { email: 'a@lean.local', passwordHash: 'x' } })).id;
  userB = (await prisma.user.create({ data: { email: 'b@lean.local', passwordHash: 'x' } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function collectingDeps(
  sent: NtfyMessage[],
  overrides: Partial<ReminderRunnerDeps> = {},
): ReminderRunnerDeps {
  return {
    listReminders: async () => [],
    hasWeightLogged: async () => false,
    hasMealLogged: async () => false,
    send: async (message: NtfyMessage): Promise<NtfySendResult> => {
      sent.push(message);
      return { sent: true };
    },
    ...overrides,
  };
}

describe('runDueReminders với nhiều người dùng', () => {
  it('chỉ người CHƯA ghi cân nhận nhắc, và gửi tới ĐÚNG topic của người đó', async () => {
    // Test quan trọng nhất của task này. Gửi nhầm topic ở đây là rò dữ liệu
    // sức khỏe sang người lạ — không có test nào khác bắt được, vì cả hai lượt
    // gửi đều "thành công" dưới góc nhìn của ntfy client.
    const sent: NtfyMessage[] = [];
    const loggedWeight = new Set([userA]);

    const deps = collectingDeps(sent, {
      listReminders: async () => [
        { userId: userA, kind: 'weigh_in', timeOfDay: '07:00', enabled: true, ntfyTopic: 'topic-a' },
        { userId: userB, kind: 'weigh_in', timeOfDay: '07:00', enabled: true, ntfyTopic: 'topic-b' },
      ],
      hasWeightLogged: async (userId: string) => loggedWeight.has(userId),
    });

    // 07:00 giờ Việt Nam = 00:00 UTC.
    await runDueReminders(new Date('2026-08-10T00:00:00.000Z'), deps);

    expect(sent).toHaveLength(1);
    expect(sent[0]!.topic).toBe('topic-b');
  });

  it('hai user cùng giờ, cả hai chưa ghi → hai lượt gửi, hai topic khác nhau', async () => {
    const sent: NtfyMessage[] = [];
    const deps = collectingDeps(sent, {
      listReminders: async () => [
        { userId: userA, kind: 'weigh_in', timeOfDay: '07:00', enabled: true, ntfyTopic: 'topic-a' },
        { userId: userB, kind: 'weigh_in', timeOfDay: '07:00', enabled: true, ntfyTopic: 'topic-b' },
      ],
    });

    await runDueReminders(new Date('2026-08-10T00:00:00.000Z'), deps);

    expect(sent.map((m) => m.topic).sort()).toEqual(['topic-a', 'topic-b']);
  });

  it('outcome mang userId để log phân biệt được ai', async () => {
    const sent: NtfyMessage[] = [];
    const deps = collectingDeps(sent, {
      listReminders: async () => [
        { userId: userB, kind: 'meal_log', timeOfDay: '07:00', enabled: true, ntfyTopic: 'topic-b' },
      ],
    });

    const outcomes = await runDueReminders(new Date('2026-08-10T00:00:00.000Z'), deps);

    expect(outcomes).toEqual([{ userId: userB, kind: 'meal_log', status: 'sent' }]);
  });

  it('hỏi điều kiện theo ĐÚNG userId của từng hàng, không phải hàng đầu tiên', async () => {
    // Canh trực tiếp cái bẫy: một vòng lặp lấy userId ra ngoài rồi dùng lại cho
    // mọi hàng vẫn cho ra "2 lượt gửi" ở test trên, nhưng hỏi sai người ở đây.
    const asked: string[] = [];
    const sent: NtfyMessage[] = [];
    const deps = collectingDeps(sent, {
      listReminders: async () => [
        { userId: userA, kind: 'weigh_in', timeOfDay: '07:00', enabled: true, ntfyTopic: 'topic-a' },
        { userId: userB, kind: 'weigh_in', timeOfDay: '07:00', enabled: true, ntfyTopic: 'topic-b' },
      ],
      hasWeightLogged: async (userId: string) => {
        asked.push(userId);
        return false;
      },
    });

    await runDueReminders(new Date('2026-08-10T00:00:00.000Z'), deps);

    expect(asked).toEqual([userA, userB]);
  });
});

describe('findRemindersForAllUsers', () => {
  it('lấy nhắc nhở của mọi user trong MỘT truy vấn, mỗi hàng mang userId', async () => {
    // Không lặp N+1 qua từng user (auth/SPEC.md:487).
    await prisma.reminder.create({
      data: { userId: userA, kind: 'weigh_in', timeOfDay: '07:00', enabled: true, ntfyTopic: 't' },
    });
    await prisma.reminder.create({
      data: { userId: userB, kind: 'meal_log', timeOfDay: '20:00', enabled: true, ntfyTopic: 'u' },
    });

    const rows = await findRemindersForAllUsers();

    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.userId))).toEqual(new Set([userA, userB]));
  });

  it('bỏ qua nhắc nhở đang tắt — không kéo về hàng chắc chắn bị loại', async () => {
    await prisma.reminder.create({
      data: { userId: userA, kind: 'weigh_in', timeOfDay: '07:00', enabled: false, ntfyTopic: 't' },
    });

    expect(await findRemindersForAllUsers()).toHaveLength(0);
  });
});
