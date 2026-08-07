import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, setCsrfTokenProvider, setOnUnauthorized } from './apiClient';
import { ApiError } from '../types/api';

// Danh sách test canh đúng "11 hành vi bắt buộc" của
// docs/features/web-shell/SPEC.md §4.7, cộng "Bốn luật dễ làm sai" nêu
// riêng ở buoc-3-brief.md (đã trùng với #6, #9, #10, #11 bên dưới — nêu
// tường minh lại để không ai lỡ xóa mất ca này khi refactor).

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(
  status: number,
  code: string,
  message = 'lỗi',
  fields?: { path: string; message: string }[],
): Response {
  return jsonResponse({ error: { code, message, ...(fields ? { fields } : {}) } }, status);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  // Trả hai chỗ móc về mặc định để test sau không thừa hưởng state của test trước.
  setOnUnauthorized(() => {});
  setCsrfTokenProvider(() => null);
});

describe('apiClient — SPEC §4.7 hành vi 1: credentials', () => {
  it('GET gắn credentials: "include"', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await apiClient.get('/goal');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('include');
  });
});

describe('apiClient — SPEC §4.7 hành vi 2: CSRF header', () => {
  it.each([
    ['POST', () => apiClient.post('/meals', { name: 'Phở', calories: 450 })],
    ['PUT', () => apiClient.put('/goal', { targetWeightKg: 68 })],
    ['PATCH', () => apiClient.patch('/meals/abc', { calories: 500 })],
    ['DELETE', () => apiClient.delete('/meals/abc')],
  ] as const)('%s gắn header x-csrf-token khi có token', async (_method, call) => {
    setCsrfTokenProvider(() => 'tok-abc');
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }, 200));

    await call();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-csrf-token']).toBe('tok-abc');
  });

  it('GET không gắn header x-csrf-token dù có token khả dụng', async () => {
    setCsrfTokenProvider(() => 'tok-abc');
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await apiClient.get('/goal');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-csrf-token']).toBeUndefined();
  });

  it('không gắn header khi provider mặc định trả null', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await apiClient.delete('/meals/abc');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-csrf-token']).toBeUndefined();
  });
});

describe('apiClient — SPEC §4.7 hành vi 3: body JSON.stringify nguyên vẹn', () => {
  it('putBodyLog(d, { waistCm: null }) gửi đi giữ khóa và giữ null', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ date: '2026-08-07', waistCm: null }));

    await apiClient.put('/body-logs/2026-08-07', { waistCm: null });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe('{"waistCm":null}');
  });

  it('gắn Content-Type: application/json chỉ khi có body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await apiClient.get('/goal');
    const [, getInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((getInit.headers as Record<string, string>)['Content-Type']).toBeUndefined();

    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await apiClient.put('/goal', { targetWeightKg: 68 });
    const [, putInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect((putInit.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });
});

describe('apiClient — SPEC §4.7 hành vi 4 & 5: 200/201 trả object đã parse', () => {
  it('200 + JSON → trả object', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ targetWeightKg: 68 }));
    const result = await apiClient.get<{ targetWeightKg: number }>('/goal');
    expect(result).toEqual({ targetWeightKg: 68 });
  });

  it('201 → trả object, không coi là lỗi', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'm1', name: 'Phở' }, 201));
    const result = await apiClient.post<{ id: string; name: string }>('/meals', {
      name: 'Phở',
      calories: 450,
    });
    expect(result).toEqual({ id: 'm1', name: 'Phở' });
  });
});

describe('apiClient — SPEC §4.7 hành vi 6: 204 không parse body', () => {
  it('204 → trả undefined, không ném lỗi parse', async () => {
    // Response thật với body rỗng: nếu code lỡ gọi res.json() trên đây,
    // .json() sẽ ném SyntaxError — test này tự phát hiện lỗi cài đặt sai.
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const result = await apiClient.delete('/meals/abc');

    expect(result).toBeUndefined();
  });
});

describe('apiClient — SPEC §4.7 hành vi 7: 400 + fields[] giữ đủ, đúng thứ tự', () => {
  it('ném ApiError mang đủ hai fields, đúng thứ tự', async () => {
    fetchMock.mockResolvedValue(
      errorResponse(400, 'VALIDATION_ERROR', 'Dữ liệu gửi lên không hợp lệ', [
        { path: 'weightKg', message: 'phải > 0' },
        { path: 'calories', message: 'phải là số nguyên' },
      ]),
    );

    await expect(apiClient.put('/body-logs/2026-08-07', { weightKg: -1 })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      fields: [
        { path: 'weightKg', message: 'phải > 0' },
        { path: 'calories', message: 'phải là số nguyên' },
      ],
    });
  });
});

describe('apiClient — SPEC §4.7 hành vi 8: 404 lỗi vs dữ liệu', () => {
  it('get() vẫn ném ApiError status 404', async () => {
    fetchMock.mockResolvedValue(errorResponse(404, 'NOT_FOUND', 'Chưa có số đo'));

    const err = await apiClient.get('/body-logs/2026-08-01').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404 });
  });

  it('getOrNull() trả null thay vì ném', async () => {
    fetchMock.mockResolvedValue(errorResponse(404, 'NOT_FOUND', 'Chưa có số đo'));

    const result = await apiClient.getOrNull('/body-logs/2026-08-01');

    expect(result).toBeNull();
  });

  it('getOrNull() vẫn ném khi lỗi khác 404', async () => {
    fetchMock.mockResolvedValue(errorResponse(500, 'INTERNAL_ERROR', 'lỗi máy chủ'));

    await expect(apiClient.getOrNull('/body-logs/2026-08-01')).rejects.toMatchObject({
      status: 500,
    });
  });
});

describe('apiClient — SPEC §4.7 hành vi 9 & "luật dễ làm sai" #1: 401', () => {
  it('401 UNAUTHORIZED gọi đúng một lần hàm xử-hết-phiên', async () => {
    const handler = vi.fn();
    setOnUnauthorized(handler);
    fetchMock.mockResolvedValue(errorResponse(401, 'UNAUTHORIZED', 'Hết phiên'));

    await expect(apiClient.get('/goal')).rejects.toMatchObject({ status: 401 });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('401 INVALID_CREDENTIALS KHÔNG gọi hàm xử-hết-phiên', async () => {
    const handler = vi.fn();
    setOnUnauthorized(handler);
    fetchMock.mockResolvedValue(errorResponse(401, 'INVALID_CREDENTIALS', 'Sai email/mật khẩu'));

    await expect(
      apiClient.post('/auth/login', { email: 'a@b.com', password: 'wrong' }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('apiClient — SPEC §4.7 hành vi 10 & "luật dễ làm sai" #2: 403 không gộp 401', () => {
  it('403 FORBIDDEN ném lên, KHÔNG gọi hàm xử-hết-phiên (không đá về login)', async () => {
    const handler = vi.fn();
    setOnUnauthorized(handler);
    fetchMock.mockResolvedValue(errorResponse(403, 'FORBIDDEN', 'Thiếu quyền'));

    await expect(apiClient.get('/goal')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('apiClient — SPEC §4.7 hành vi 11 & "luật dễ làm sai" #4: lỗi mạng', () => {
  it('fetch ném (mất mạng) → ApiError status 0, code NETWORK_ERROR', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const err = await apiClient.get('/goal').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('phản hồi không phải JSON hợp lệ cũng ra ApiError status 0', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>502 Bad Gateway</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    );

    await expect(apiClient.get('/goal')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });
  });
});

describe('apiClient — CSRF: 403 CSRF_ERROR thử lại đúng một lần (SPEC §4.2 #5)', () => {
  it('lấy token mới và thử lại một lần, thành công thì trả kết quả', async () => {
    let calls = 0;
    setCsrfTokenProvider(() => {
      calls += 1;
      return calls === 1 ? 'token-cu' : 'token-moi';
    });
    fetchMock
      .mockResolvedValueOnce(errorResponse(403, 'CSRF_ERROR', 'Token sai'))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await apiClient.post('/meals', { name: 'Phở', calories: 450 });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect((secondInit.headers as Record<string, string>)['x-csrf-token']).toBe('token-moi');
  });

  it('lần hai vẫn hỏng thì ném lên, không thử lần ba', async () => {
    setCsrfTokenProvider(() => 'token');
    // `mockImplementation` (không phải `mockResolvedValue`) — apiClient tự
    // gọi fetch hai lần bên trong một request (gốc + thử lại), và mỗi
    // `Response` chỉ đọc `.json()` được đúng một lần. Dùng chung một instance
    // cho cả hai lần gọi sẽ ném "body already used" ở lần đọc thứ hai, che
    // mất hành vi thật đang được kiểm.
    fetchMock.mockImplementation(() =>
      Promise.resolve(errorResponse(403, 'CSRF_ERROR', 'Token sai')),
    );

    await expect(apiClient.post('/meals', { name: 'Phở', calories: 450 })).rejects.toMatchObject({
      status: 403,
      code: 'CSRF_ERROR',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
