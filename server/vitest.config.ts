import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    fileParallelism: false,
    // DB riêng cho test. Bắt buộc: các test gọi deleteMany() ở beforeEach —
    // trỏ vào data.db sẽ xóa sạch dữ liệu sức khỏe thật của người dùng.
    // globalSetup (prisma db push cho test.db) được thêm ở Task 2, khi
    // schema.prisma tồn tại.
    env: { DATABASE_URL: 'file:./test.db' },
    globalSetup: ['./test/globalSetup.ts'],
  },
});
