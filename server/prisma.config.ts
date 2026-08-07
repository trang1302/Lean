import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 đọc connection string từ đây, không còn từ datasource trong schema.
// Test chạy với DATABASE_URL trỏ sang test.db — xem test/globalSetup.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
