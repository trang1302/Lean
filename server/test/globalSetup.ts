import { execSync } from 'node:child_process';

/** Dựng schema cho DB test trước khi chạy suite. Chạy một lần cho cả run. */
export default function setup(): void {
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
    stdio: 'inherit',
  });
}
