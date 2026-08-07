import { createApp } from './app.js';
import { env } from './config/env.js';
import { startReminderScheduler, stopReminderScheduler } from './features/reminders/index.js';

/**
 * Entry point. `app.ts` lắp app nhưng không `listen()` — việc đó ở đây, để
 * supertest dựng app trong test mà không chiếm cổng.
 *
 * Scheduler khởi động SAU khi server đã listen, và chỉ ở đây. Import module
 * scheduler không tự chạy cron — nếu không test sẽ dính đồng hồ thật.
 */
const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`Lean server: http://localhost:${env.PORT}`);
  startReminderScheduler();
  console.log('Nhắc nhở: đang chạy. Tắt server là ngừng nhắc, không gửi bù.');
});

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} — đang dừng...`);
  await stopReminderScheduler();
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
