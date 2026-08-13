// PHẢI là import đầu tiên. ESM đánh giá module theo thứ tự khai báo import, nên
// dòng này chạy trước `./app.js` → trước `./config/env.js`, tức là `.env` đã nạp
// xong khi `envSchema.parse` chạy. Đổi nó xuống dưới là làm tiến trình chết vì
// thiếu SESSION_SECRET.
//
// Chỉ nạp ở ENTRY POINT, không nạp trong `config/env.ts`: test lấy env từ
// `vitest.config.ts`, và nạp `.env` ở đó sẽ kéo theo DATABASE_URL trỏ vào
// `data.db` thật — đúng thứ `test/globalSetup.ts` phải chặn cứng.
import 'dotenv/config';
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
