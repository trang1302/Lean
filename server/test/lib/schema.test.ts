import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../src/lib/db.js';

beforeEach(async () => {
  await prisma.bodyLog.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('lược đồ User', () => {
  it('email trùng bị chặn ở tầng DB, không chỉ ở tầng app', async () => {
    await prisma.user.create({
      data: { email: 'a@lean.local', passwordHash: 'x' },
    });

    await expect(
      prisma.user.create({ data: { email: 'a@lean.local', passwordHash: 'y' } }),
    ).rejects.toThrow();
  });

  it('email khác hoa thường là HAI tài khoản — nên chuẩn hóa phải làm ở tầng DTO', async () => {
    // Không phải bug: @unique của SQLite phân biệt hoa thường. Test này ghi lại
    // sự thật đó để không ai tin rằng DB tự chống trùng (auth/SPEC.md:353).
    await prisma.user.create({ data: { email: 'a@lean.local', passwordHash: 'x' } });
    const upper = await prisma.user.create({
      data: { email: 'A@lean.local', passwordHash: 'y' },
    });

    expect(upper.id).toBeTruthy();
  });
});

describe('khóa ngoại thật sự được cưỡng chế', () => {
  it('BodyLog với userId không tồn tại bị từ chối VÌ khóa ngoại', async () => {
    // SQLite chỉ cưỡng chế FK khi PRAGMA foreign_keys = ON. `better-sqlite3@13`
    // bật sẵn, nên `src/lib/db.ts` không cần pragma tường minh — nhưng đó là
    // mặc định của THƯ VIỆN, không phải của SQLite. Nâng cấp hay đổi adapter có
    // thể lấy nó đi trong im lặng.
    //
    // Vì vậy phải khẳng định ĐÚNG mã lỗi P2003, không phải `toThrow()` trần.
    // `toThrow()` trần cũng xanh khi lỗi là chuyện khác hoàn toàn (sai kiểu,
    // thiếu cột) — tức là nó xanh cả khi khóa ngoại đã ngừng bảo vệ gì.
    await expect(
      prisma.bodyLog.create({
        data: { userId: 'khong-ton-tai', date: '2026-08-10', weightKg: 70 },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('xóa User kéo theo xóa BodyLog của user đó (onDelete: Cascade)', async () => {
    // Cascade không phải tiện nghi: thiếu nó thì xóa tài khoản để lại số đo mồ
    // côi — dữ liệu sức khỏe của một người không còn tài khoản nào trỏ tới.
    const user = await prisma.user.create({
      data: { email: 'cascade@lean.local', passwordHash: 'x' },
    });
    await prisma.bodyLog.create({
      data: { userId: user.id, date: '2026-08-10', weightKg: 70 },
    });

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.bodyLog.count({ where: { userId: user.id } })).toBe(0);
  });
});
