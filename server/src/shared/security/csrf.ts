import { doubleCsrf } from 'csrf-csrf';
import type { Request } from 'express';
import { env } from '../../config/env.js';

/**
 * Double-submit cookie CÓ KÝ: token nằm trong một cookie riêng (`lean.csrf`)
 * *và* phải được gửi lại ở header `x-csrf-token`. Trang khác miền không đọc
 * được cookie nên không dựng được header khớp.
 *
 * Lean BẬT CSRF, cố ý khác upip (upip tắt ở gateway vì FE của nó là SPA khác
 * miền — auth/SPEC.md:555). Lean phục vụ web CÙNG origin bằng cookie phiên
 * `httpOnly` → CSRF là mối đe dọa thật.
 *
 * Xác nhận trên csrf-csrf@4.0.3 (`dist/index.d.ts`): `doubleCsrf(config)` trả
 * `{ generateCsrfToken, doubleCsrfProtection, ... }`; mặc định đọc token từ
 * header `x-csrf-token`, mã lỗi `EBADCSRFTOKEN` (khớp nhánh nhận diện trong
 * `errorHandler`), và đọc cookie qua `req.cookies` — vì vậy `cookie-parser`
 * PHẢI mắc trước middleware này trong `app.ts`.
 */

/**
 * Định danh phiên để buộc token vào đúng người dùng.
 *
 * Dùng `req.session.userId`, **KHÔNG** dùng `req.sessionID` như phản xạ thông
 * thường. Lý do nằm ở kiến trúc store: `Session.userId` là NOT NULL + có khóa
 * ngoại tới `User`, nên phiên VÔ DANH không ghi xuống DB được
 * (`prismaSessionStore.set`, và `saveUninitialized: false` ở `app.ts`). Khách
 * chưa đăng nhập vì thế không giữ được cookie `lean.sid`, và `req.sessionID`
 * là một chuỗi ngẫu nhiên MỚI ở mỗi request — token cấp ở `GET /csrf` sẽ không
 * bao giờ khớp lúc `POST /login` verify, tức là chặn đứng chính đường đăng nhập.
 *
 * Chuỗi rỗng cho khách vô danh là ổn định giữa các request nên `POST /login`
 * và `POST /register` VẪN được CSRF bảo vệ (kẻ tấn công khác miền vẫn không
 * đọc nổi cookie `lean.csrf` để dựng header).
 *
 * Hệ quả phải nhớ: sau khi đăng nhập, định danh đổi từ `''` sang `userId`, nên
 * token lấy trước lúc đăng nhập HẾT hiệu lực. Client (và test) phải gọi lại
 * `GET /api/auth/csrf` một lần nữa SAU khi đăng nhập.
 */
function getSessionIdentifier(req: Request): string {
  return req.session?.userId ?? '';
}

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => env.SESSION_SECRET,
  getSessionIdentifier,
  cookieName: 'lean.csrf',
  cookieOptions: {
    // Cookie này mang secret của cặp double-submit, không phải token client
    // đọc — httpOnly được và nên bật.
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
  },
});

export { doubleCsrfProtection as csrfProtection, generateCsrfToken };
