// `defineConfig` từ 'vitest/config' (không phải 'vite') — vẫn đúng kiểu
// `UserConfig` của Vite cho `plugins`/`server`, nhưng thêm trường `test` được
// gõ kiểu. Dùng một file cấu hình duy nhất để tránh proxy `/api` bị khai báo
// lệch giữa `vite.config.ts` và một `vitest.config.ts` riêng.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // BẮT BUỘC, không phải tiện nghi: web chạy :5173, API chạy :3000 — khác
      // origin. Cookie phiên dùng sameSite='lax' (chỉ đúng cùng origin); gọi
      // thẳng :3000 sẽ buộc hạ xuống sameSite='none' + CORS, tức tự tháo lớp
      // phòng vệ CSRF cấp cookie chỉ để tiện lúc dev. Xem SPEC.md §3.3.
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    // jsdom vì `web-today` Bước 3 cần test component thật (input, aria-invalid),
    // không chỉ hàm thuần — môi trường Node mặc định của Vitest không có DOM.
    environment: 'jsdom',
    // Dọn DOM sau mỗi test (xem test/setup.ts) — thiếu bước này, phần tử của
    // test trước sẽ còn sống sang test sau và làm `getByText` khớp nhầm.
    setupFiles: ['./test/setup.ts'],
    // Mặc định để Vitest tự chọn (`forks`). Chỉ ghi đè trong môi trường chặn
    // tạo tiến trình con — ví dụ sandbox của công cụ agent, nơi `forks` treo tới
    // timeout. Đã kiểm: `forks` chạy bình thường trên terminal thật.
    //   VITEST_POOL=threads npm test
    pool: process.env['VITEST_POOL'] as 'threads' | 'forks' | undefined,
  },
});
