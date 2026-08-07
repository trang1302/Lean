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
    env: { DATABASE_URL: TEST_DATABASE_URL },
    globalSetup: ['./test/globalSetup.ts'],
  },
});
