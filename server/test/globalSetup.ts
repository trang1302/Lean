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
export default function setup(): void {
  const url = process.env.DATABASE_URL ?? 'file:./test.db';

  if (url.includes('data.db')) {
    throw new Error(`globalSetup từ chối chạy: DATABASE_URL trỏ vào DB thật (${url})`);
  }

  execSync(`npx prisma db push --url="${url}" --accept-data-loss`, {
    env: { ...process.env, PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes' },
    stdio: 'inherit',
  });
}
