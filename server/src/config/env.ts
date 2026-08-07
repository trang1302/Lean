import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  NTFY_BASE_URL: z.url().default('https://ntfy.sh'),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL ?? 'file:./data.db',
  PORT: process.env.PORT,
  NTFY_BASE_URL: process.env.NTFY_BASE_URL,
});
