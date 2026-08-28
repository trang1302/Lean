import { execSync } from 'node:child_process';

/**
 * Dựng schema cho DB test trước khi chạy suite. Chạy một lần cho cả run.
 *
 * Prisma 7 bỏ cờ `--skip-generate`, thêm `--url` để ghi đè datasource.
 *
 * Về PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION:
 * Prisma 7 chặn AI agent chạy lệnh migrate vì sợ agent xóa nhầm DB production.
 * Ở đây đích luôn là một file test-*.db do vitest.config.ts quyết định, mặc
 * định `file:./test.db`. DB test bị `deleteMany()` ở mỗi `beforeEach`, không
 * bao giờ chứa dữ liệu thật.
 *
 * ĐỪNG copy biến này sang lệnh migrate nào khác, và ĐỪNG trỏ DATABASE_URL của
 * test vào `data.db` — nó sẽ xóa sạch dữ liệu sức khỏe thật.
 */
export default async function setup(): Promise<void> {
  const url = process.env.DATABASE_URL ?? 'file:./test.db';

  if (url.includes('data.db')) {
    throw new Error(`globalSetup từ chối chạy: DATABASE_URL trỏ vào DB thật (${url})`);
  }

  execSync(`npx prisma db push --url="${url}" --accept-data-loss`, {
    env: { ...process.env, PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes' },
    stdio: 'inherit',
  });

  // BẮT BUỘC đặt trước khi import seed: `src/lib/db.ts` đọc `env.DATABASE_URL`
  // NGAY lúc module được nạp, và `vitest.config.ts` chỉ tiêm env cho môi
  // trường TEST chứ không cho globalSetup. Thiếu dòng này thì seed rơi về
  // `file:./data.db` của `.env` — tức là ghi vào DB thật.
  // (`dotenv/config` trong seed không ghi đè biến đã có sẵn.)
  process.env.DATABASE_URL = url;
  process.env.SESSION_SECRET ??= 'test-session-secret-at-least-32-characters-long';
  process.env.NODE_ENV ??= 'test';

  // Vai trò và quyền là DỮ LIỆU THAM CHIẾU, không phải fixture của một test.
  // Không có chúng thì mọi user có tập quyền rỗng và toàn bộ suite trả 403.
  //
  // Dùng lại đúng hàm mà `npm run seed:rbac` gọi — chép một bản riêng cho test
  // là cách chắc chắn để test xanh trong khi app thật sai. `backfill: false`
  // vì từng test tự dựng user với vai trò nó cần.
  const { seedRbac } = await import('../prisma/seed/rbac.seed.js');
  await seedRbac({ backfill: false });
}
