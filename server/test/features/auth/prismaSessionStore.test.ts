import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../../../src/lib/db.js';
import { PrismaSessionStore } from '../../../src/features/auth/prismaSessionStore.js';

const store = new PrismaSessionStore();
let userId: string;

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  const user = await prisma.user.create({
    data: { email: 'store@lean.local', passwordHash: 'x' },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function setSession(sid: string, data: Record<string, unknown>, expiresAt: Date): Promise<void> {
  return new Promise((resolve, reject) => {
    store.set(sid, { cookie: { expires: expiresAt }, ...data } as never, (err) =>
      err ? reject(err) : resolve(),
    );
  });
}

function getSession(sid: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    store.get(sid, (err, session) => (err ? reject(err) : resolve(session)));
  });
}

describe('PrismaSessionStore', () => {
  it('set rồi get trả lại đúng payload', async () => {
    const future = new Date(Date.now() + 60_000);
    await setSession('sid-1', { userId }, future);

    const session = await getSession('sid-1');
    expect(session).toMatchObject({ userId });
  });

  it('nhấc userId ra CỘT RIÊNG, không chỉ nằm trong blob data', async () => {
    // Không có cột này thì không truy vấn được "mọi phiên của user X", tức là
    // §7.6 (đá phiên cũ) và §7.7 (thu hồi khi đổi mật khẩu) không làm được.
    // Đây là lý do connect-sqlite3 bị loại (auth/SPEC.md:109-122).
    await setSession('sid-2', { userId }, new Date(Date.now() + 60_000));

    const row = await prisma.session.findUnique({ where: { id: 'sid-2' } });
    expect(row?.userId).toBe(userId);
  });

  it('destroy rồi get trả rỗng', async () => {
    await setSession('sid-3', { userId }, new Date(Date.now() + 60_000));
    await new Promise<void>((resolve, reject) => {
      store.destroy('sid-3', (err) => (err ? reject(err) : resolve()));
    });

    expect(await getSession('sid-3')).toBeFalsy();
  });

  it('phiên đã quá expiresAt coi như không tồn tại VÀ hàng bị dọn', async () => {
    await setSession('sid-4', { userId }, new Date(Date.now() - 1_000));

    expect(await getSession('sid-4')).toBeFalsy();
    expect(await prisma.session.findUnique({ where: { id: 'sid-4' } })).toBeNull();
  });

  it('touch đẩy expiresAt xa thêm (rolling session)', async () => {
    const near = new Date(Date.now() + 1_000);
    await setSession('sid-5', { userId }, near);

    const far = new Date(Date.now() + 600_000);
    await new Promise<void>((resolve, reject) => {
      store.touch('sid-5', { cookie: { expires: far } } as never, (err) =>
        err ? reject(err) : resolve(),
      );
    });

    const row = await prisma.session.findUnique({ where: { id: 'sid-5' } });
    expect(row!.expiresAt.getTime()).toBeGreaterThan(near.getTime());
  });

  it('get trên sid chưa từng tồn tại trả rỗng, KHÔNG ném lỗi', async () => {
    expect(await getSession('chua-bao-gio-co')).toBeFalsy();
  });

  it('phiên KHÔNG có userId bị bỏ qua im lặng — hợp đồng với saveUninitialized:false', async () => {
    // Cột `Session.userId` là NOT NULL + có khóa ngoại, nên phiên vô danh không
    // có giá trị hợp lệ nào để ghi. `set` vẫn báo thành công (không ném) nhưng
    // KHÔNG tạo hàng nào.
    //
    // Test này ghi lại rằng đó là hành vi CÓ CHỦ ĐÍCH, không phải bug — và đồng
    // thời là lời cảnh báo: nếu `app.ts` đặt `saveUninitialized: true` thì mọi
    // phiên chưa đăng nhập sẽ mất trong im lặng mà không lỗi nào nổi lên.
    await setSession('sid-vo-danh', {}, new Date(Date.now() + 60_000));

    expect(await prisma.session.findUnique({ where: { id: 'sid-vo-danh' } })).toBeNull();
    expect(await getSession('sid-vo-danh')).toBeFalsy();
  });

  it('set hai lần cùng sid thì cập nhật, không tạo hàng thứ hai', async () => {
    const future = new Date(Date.now() + 60_000);
    await setSession('sid-6', { userId, buoc: 1 }, future);
    await setSession('sid-6', { userId, buoc: 2 }, future);

    expect(await prisma.session.count({ where: { id: 'sid-6' } })).toBe(1);
    expect(await getSession('sid-6')).toMatchObject({ buoc: 2 });
  });
});
