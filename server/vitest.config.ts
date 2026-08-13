import { defineConfig } from 'vitest/config';

/**
 * DB riêng cho test. Bắt buộc: các test gọi deleteMany() ở beforeEach —
 * trỏ vào data.db sẽ xóa sạch dữ liệu sức khỏe thật của người dùng.
 *
 * Cho phép ghi đè qua biến môi trường để chạy được nhiều suite song song
 * mà không giẫm lên nhau:
 *   DATABASE_URL=file:./test-meals.db npx vitest run test/features/meals
 */
const TEST_DATABASE_URL = process.env.DATABASE_URL ?? 'file:./test.db';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    fileParallelism: false,
    // `SESSION_SECRET` không có `.default()` trong `env.ts` (cố ý — fallback cho
    // secret nghĩa là mọi bản triển khai dùng chung một khóa ký). Thiếu nó ở đây
    // thì mọi test import `app.ts` chết ngay tại `envSchema.parse`.
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      SESSION_SECRET: 'test-session-secret-at-least-32-characters-long',
      NODE_ENV: 'test',
    },
    globalSetup: ['./test/globalSetup.ts'],
  },
});
