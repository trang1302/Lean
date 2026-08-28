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
import { pruneExpiredSessions } from './features/auth/prismaSessionStore.js';
import { deleteAttemptsBefore } from './features/auth/repositories/loginAttempt.repository.js';
import { startReminderScheduler, stopReminderScheduler } from './features/reminders/index.js';

/**
 * Entry point. `app.ts` lắp app nhưng không `listen()` — việc đó ở đây, để
 * supertest dựng app trong test mà không chiếm cổng.
 *
 * Scheduler khởi động SAU khi server đã listen, và chỉ ở đây. Import module
 * scheduler không tự chạy cron — nếu không test sẽ dính đồng hồ thật.
 */
const app = createApp();

/**
 * Bảng `Session` phình vô hạn nếu không dọn: hàng đã hết hạn không bao giờ
 * được đọc lại nên cũng không có dịp nào tự phát hiện mà xóa.
 */
const PRUNE_INTERVAL_MS = 60 * 60 * 1000; // mỗi giờ

/**
 * Giữ hàng `LoginAttempt` lâu hơn cửa sổ khóa (15 phút) một quãng rộng: hàng cũ
 * hơn thế không còn ảnh hưởng quyết định khóa nữa, nhưng vẫn hữu ích để nhìn lại
 * một đợt dò mật khẩu vừa xảy ra.
 */
const ATTEMPT_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 giờ

let pruneTimer: NodeJS.Timeout | null = null;

const server = app.listen(env.PORT, () => {
  console.log(`Lean server: http://localhost:${env.PORT}`);
  startReminderScheduler();
  console.log('Nhắc nhở: đang chạy. Tắt server là ngừng nhắc, không gửi bù.');

  pruneTimer = setInterval(() => {
    void pruneExpiredSessions().catch((err: unknown) => {
      // Không để lỗi dọn dẹp hạ tiến trình, nhưng cũng không im lặng.
      console.error('[prune-sessions]', err);
    });
    void deleteAttemptsBefore(new Date(Date.now() - ATTEMPT_RETENTION_MS)).catch(
      (err: unknown) => {
        console.error('[prune-login-attempts]', err);
      },
    );
  }, PRUNE_INTERVAL_MS);

  // `unref()` để timer không giữ tiến trình sống khi đang shutdown.
  pruneTimer.unref();
});

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} — đang dừng...`);
  if (pruneTimer) clearInterval(pruneTimer);
  await stopReminderScheduler();
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
