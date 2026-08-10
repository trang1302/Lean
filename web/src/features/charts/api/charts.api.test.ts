// Mock `fetch` toàn cục, đi qua `apiClient` THẬT — không mock `apiClient`
// (điều phối viên B6: server chưa migrate được để đối chứng thật; cùng
// cách `today.api.test.ts` làm cho web-today).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSummary } from './charts.api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('charts.api — getSummary', () => {
  it('gọi GET /api/summary?from=&to= với đúng query, KHÔNG gọi endpoint nào khác (SPEC §2)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ days: [], weeks: [], goal: {} }));

    await getSummary('2026-07-08', '2026-08-06');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/summary?from=2026-07-08&to=2026-08-06');
    expect(init.method).toBe('GET');
  });

  it('trả nguyên payload JSON của response', async () => {
    const payload = { days: [{ date: '2026-08-06' }], weeks: [], goal: { targetWeightKg: null } };
    fetchMock.mockResolvedValue(jsonResponse(payload));

    const result = await getSummary('2026-08-06', '2026-08-06');

    expect(result).toEqual(payload);
  });

  it('lỗi 400 ném ApiError giữ nguyên status/code (không tự bắt/nuốt lỗi)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'VALIDATION_ERROR', message: 'from phải <= to' } }, 400),
    );

    await expect(getSummary('2026-08-06', '2026-07-01')).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  });
});
