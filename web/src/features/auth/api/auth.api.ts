// Bốn hàm mỏng ánh xạ đúng bốn endpoint của server/src/features/auth/ —
// không state, không React, không try/catch nuốt lỗi.
//
// `apiClient` (web/src/lib/apiClient.ts) là nơi DUY NHẤT gọi `fetch()`, và nó
// đã bật `credentials: 'include'` sẵn — thiếu cờ đó thì trình duyệt không gửi
// cookie `lean.sid` và mọi request đều 401.

import { apiClient } from '../../../lib/apiClient';
import { ApiError, type SessionResponse, type SessionUser } from '../../../types/api';

/**
 * CSRF token hiện hành, giữ trong bộ nhớ module — KHÔNG localStorage.
 *
 * Server bật `csrf-csrf` (double-submit cookie có ký): mọi POST/PUT/PATCH/DELETE
 * thiếu header `x-csrf-token` khớp cookie `lean.csrf` đều nhận `403 CSRF_ERROR`.
 * `apiClient` gắn header đó từ hàm được cắm qua `setCsrfTokenProvider`; đây là
 * nguồn của nó.
 *
 * PHẢI lấy lại sau mỗi lần đăng nhập VÀ đăng xuất: server buộc token vào
 * `req.session.userId` (server/src/shared/security/csrf.ts), nên token cấp lúc
 * còn vô danh chết ngay khi phiên bắt đầu, và ngược lại.
 */
let csrfToken: string | null = null;

/** Hàm cắm vào `setCsrfTokenProvider` — đọc đồng bộ, không gọi mạng. */
export function currentCsrfToken(): string | null {
  return csrfToken;
}

export async function refreshCsrfToken(): Promise<string> {
  const res = await apiClient.get<{ csrfToken: string }>('/auth/csrf');
  csrfToken = res.csrfToken;
  return csrfToken;
}

/** Lấy token nếu chưa có. Chặn ca người dùng bấm Đăng nhập trước khi app kịp nạp. */
async function ensureCsrfToken(): Promise<void> {
  if (csrfToken === null) await refreshCsrfToken();
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName?: string;
}

/**
 * `POST /api/auth/login` — 200 kèm `Set-Cookie: lean.sid`.
 *
 * Sai mật khẩu trả `401 INVALID_CREDENTIALS`, và `apiClient` CỐ Ý không coi mã
 * đó là "hết phiên" nên nó không đá người dùng ra khỏi `/login`. Sai email
 * cũng trả đúng mã và đúng message đó — server không phân biệt hai ca, để form
 * đăng nhập không thành công cụ dò xem email nào có tài khoản.
 */
export async function login(input: LoginInput): Promise<SessionResponse> {
  await ensureCsrfToken();
  const session = await apiClient.post<SessionResponse>('/auth/login', input);
  // Phiên vừa bắt đầu → định danh buộc token đổi từ '' sang userId. Bỏ dòng này
  // là mọi thao tác ghi sau khi đăng nhập nhận 403.
  await refreshCsrfToken();
  return session;
}

/**
 * `POST /api/auth/register` — 201. Mật khẩu tối thiểu 8 ký tự áp ở ĐÂY (đường
 * đặt mật khẩu), không áp ở đường đăng nhập. Email trùng trả `400
 * VALIDATION_ERROR` với `fields[].path === 'email'`.
 *
 * KHÔNG tự đăng nhập sau khi đăng ký: server không mở phiên ở endpoint này.
 */
export async function register(input: RegisterInput): Promise<{ user: SessionUser }> {
  await ensureCsrfToken();
  return apiClient.post<{ user: SessionUser }>('/auth/register', input);
}

/** `POST /api/auth/logout` — 204, idempotent (gọi khi đã hết phiên vẫn 204). */
export async function logout(): Promise<void> {
  await ensureCsrfToken();
  await apiClient.post<void>('/auth/logout');
  // Phiên kết thúc → định danh về lại ''. Lấy token mới để màn hình đăng nhập
  // kế tiếp dùng được ngay.
  await refreshCsrfToken();
}

/**
 * `GET /api/auth/session` — nguồn sự thật DUY NHẤT về "đang đăng nhập hay
 * chưa". Không đọc localStorage, không tin một cờ nào phía client: cookie là
 * `httpOnly` nên JS không thấy được, và một cờ tự lưu sẽ lệch với thực tế ngay
 * lần phiên hết hạn đầu tiên.
 *
 * Chưa đăng nhập là `401`, tức là chuyện BÌNH THƯỜNG ở đây — dịch thành `null`
 * thay vì ném, để `SessionProvider` không phải bọc try/catch quanh ca thường gặp
 * nhất. Lỗi khác (mạng, 500) vẫn ném.
 */
export async function getSession(): Promise<SessionResponse | null> {
  try {
    return await apiClient.get<SessionResponse>('/auth/session');
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}
