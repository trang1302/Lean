import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  NTFY_BASE_URL: z.url().default('https://ntfy.sh'),
  // KHÔNG có .default(): fallback cho secret nghĩa là mọi bản triển khai dùng
  // chung một khóa ký (auth/SPEC.md §7.8). Thiếu biến → tiến trình chết ngay.
  SESSION_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL ?? 'file:./data.db',
  PORT: process.env.PORT,
  NTFY_BASE_URL: process.env.NTFY_BASE_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  NODE_ENV: process.env.NODE_ENV,
});
