// CHỖ DUY NHẤT trong `web/` được gọi `fetch()`. Không ngoại lệ, không "tạm
// thời". Xem docs/features/web-shell/SPEC.md §4 — luật đầy đủ và lý do.
//
// Ba chỗ móc bắt buộc cho các bước sau (auth/rbac, Bước 8 & 10 của
// docs/features/web-shell/PLAN.md), đã bật/khai báo sẵn NGAY TỪ BÂY GIỜ:
//   1. `credentials: 'include'` trên mọi request.
//   2. `setOnUnauthorized` — Bước 10 gắn hàm điều hướng `/login` thật.
//   3. `setCsrfTokenProvider` — Bước 8 gắn hàm đọc CSRF token thật.
// Mặc định của (2) là no-op, mặc định của (3) là trả `null` (không gắn
// header) — vô hại khi server chưa có phiên/CSRF.

import { ApiError, type FieldError } from '../types/api';

export { ApiError } from '../types/api';

const BASE_URL = '/api'; // tương đối — KHÔNG bao giờ hard-code host (SPEC §3.3, §4.2 #1)

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// CSRF chỉ gắn cho method ghi (SPEC §4.2 #5) — GET không cần.
const WRITE_METHODS: ReadonlySet<HttpMethod> = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const NETWORK_ERROR_CODE = 'NETWORK_ERROR';

type UnauthorizedHandler = () => void;
type CsrfTokenProvider = () => string | null;

let onUnauthorized: UnauthorizedHandler = () => {
  // Mặc định no-op — Bước 10 (auth) gắn điều hướng `/login?next=…` thật qua
  // `setOnUnauthorized`. Không làm gì ở đây là đúng: chưa có phiên/auth thì
  // không có gì để điều hướng.
};

let getCsrfToken: CsrfTokenProvider = () => null;
// Mặc định trả `null` → không gắn header `x-csrf-token` (SPEC §4.2 #5).
// Bước 8 (auth) gắn `setCsrfTokenProvider` đọc token thật từ bộ nhớ module
// của `features/auth/api/auth.api.ts` (lấy qua `GET /api/auth/csrf`).

/** Thay hàm xử "hết phiên" (401 UNAUTHORIZED). Mặc định no-op. */
export function setOnUnauthorized(handler: UnauthorizedHandler): void {
  onUnauthorized = handler;
}

/** Thay hàm đọc CSRF token hiện tại. Mặc định trả `null`. */
export function setCsrfTokenProvider(provider: CsrfTokenProvider): void {
  getCsrfToken = provider;
}

interface ErrorResponseBody {
  error?: {
    code?: string;
    message?: string;
    fields?: FieldError[];
  };
}

interface RequestSpec {
  method: HttpMethod;
  body?: unknown;
}

async function request<T>(path: string, spec: RequestSpec, isCsrfRetry = false): Promise<T> {
  const headers: Record<string, string> = {};
  const hasBody = spec.body !== undefined;
  if (hasBody) {
    headers['Content-Type'] = 'application/json'; // chỉ khi có body (SPEC §4.2 #3)
  }
  if (WRITE_METHODS.has(spec.method)) {
    const token = getCsrfToken();
    if (token) headers['x-csrf-token'] = token;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: spec.method,
      credentials: 'include', // trên MỌI request, không chỉ request ghi (SPEC §4.2 #2)
      headers,
      // JSON.stringify nguyên vẹn object caller đưa — không tự bù trường
      // thiếu, không tự lọc `null`. `{ waistCm: null }` phải giữ khóa và
      // giữ `null` (hợp đồng upsert 3 trạng thái, SPEC §4.2 #4).
      body: hasBody ? JSON.stringify(spec.body) : undefined,
    });
  } catch {
    // Mất mạng, DNS hỏng, server chưa bật — `fetch` ném `TypeError` thô.
    // Dịch về cùng một loại lỗi để UI chỉ có MỘT kiểu catch (SPEC §4.3).
    throw new ApiError(0, NETWORK_ERROR_CODE, 'Không kết nối được server — server đã chạy chưa?');
  }

  // `204` không có body — KHÔNG được gọi `res.json()` trên đó, nó ném lỗi
  // parse (SPEC §4.4). Trả `undefined` ngay, trước khi chạm tới parse.
  if (res.status === 204) {
    return undefined as T;
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    // Body không phải JSON hợp lệ (proxy trả HTML 502, v.v.) — cùng nhóm lỗi
    // "không lấy được câu trả lời thật" như lỗi mạng (SPEC §4.3).
    throw new ApiError(0, NETWORK_ERROR_CODE, 'Không đọc được phản hồi từ server');
  }

  if (res.ok) {
    return payload as T;
  }

  const body = payload as ErrorResponseBody;
  const code = body.error?.code ?? 'INTERNAL_ERROR';
  const message = body.error?.message ?? 'Lỗi không xác định';
  const fields = body.error?.fields;

  // 403 CSRF_ERROR: lấy token mới và thử lại ĐÚNG MỘT LẦN (SPEC §4.2 #5).
  // Gọi lại `getCsrfToken()` ở lần thử thứ hai — provider thật (Bước 8) chịu
  // trách nhiệm trả token mới tại thời điểm đó.
  if (res.status === 403 && code === 'CSRF_ERROR' && !isCsrfRetry) {
    return request<T>(path, spec, true);
  }

  // 401 UNAUTHORIZED = hết phiên → gọi hàm xử lý DUY NHẤT (SPEC §4.6).
  // 401 INVALID_CREDENTIALS (sai mật khẩu lúc đăng nhập) KHÔNG được gọi —
  // nếu không, đăng nhập sai một lần sẽ tự đá người dùng ra khỏi /login.
  if (res.status === 401 && code !== 'INVALID_CREDENTIALS') {
    onUnauthorized();
  }

  // 403 FORBIDDEN (thiếu quyền) KHÔNG được gộp vào nhánh 401 ở trên — ném
  // lên cho caller, không tự đá về /login (SPEC §4.6). Phân biệt bằng
  // `status`, không bằng `code`.
  throw new ApiError(res.status, code, message, fields);
}

/**
 * `apiClient` — điểm gọi HTTP duy nhất của `web/`. Mọi status >= 400 ném
 * `ApiError` giữ nguyên `status` + `code` + `message` + `fields` (SPEC §4.3).
 */
export const apiClient = {
  get<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'GET' });
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'POST', body });
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'PUT', body });
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'PATCH', body });
  },

  delete<T = undefined>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' });
  },

  /**
   * `404` là dữ liệu, không phải lỗi (vd. `GET /body-logs/:date` cho ngày
   * chưa ghi). `apiClient` không tự quyết ca nào là ca nào (SPEC §4.5) —
   * helper này chỉ dành cho nơi gọi đã biết `404` ở đó là bình thường.
   * Mọi lỗi khác vẫn ném nguyên `ApiError`.
   */
  async getOrNull<T>(path: string): Promise<T | null> {
    try {
      return await request<T>(path, { method: 'GET' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },
};
