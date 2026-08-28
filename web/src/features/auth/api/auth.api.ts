// Bốn hàm mỏng ánh xạ đúng bốn endpoint của server/src/features/auth/ —
// không state, không React, không try/catch nuốt lỗi.
//
// `apiClient` (web/src/lib/apiClient.ts) là nơi DUY NHẤT gọi `fetch()`, và nó
// đã bật `credentials: 'include'` sẵn — thiếu cờ đó thì trình duyệt không gửi
// cookie `lean.sid` và mọi request đều 401.

import { apiClient } from '../../../lib/apiClient';
import { ApiError, type SessionResponse, type SessionUser } from '../../../types/api';

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
export function login(input: LoginInput): Promise<SessionResponse> {
  return apiClient.post<SessionResponse>('/auth/login', input);
}

/**
 * `POST /api/auth/register` — 201. Mật khẩu tối thiểu 8 ký tự áp ở ĐÂY (đường
 * đặt mật khẩu), không áp ở đường đăng nhập. Email trùng trả `400
 * VALIDATION_ERROR` với `fields[].path === 'email'`.
 *
 * KHÔNG tự đăng nhập sau khi đăng ký: server không mở phiên ở endpoint này.
 */
export function register(input: RegisterInput): Promise<{ user: SessionUser }> {
  return apiClient.post<{ user: SessionUser }>('/auth/register', input);
}

/** `POST /api/auth/logout` — 204, idempotent (gọi khi đã hết phiên vẫn 204). */
export function logout(): Promise<void> {
  return apiClient.post<void>('/auth/logout');
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
