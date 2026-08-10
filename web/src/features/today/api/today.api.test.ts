import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMeal,
  deleteMeal,
  getBodyLog,
  getGoal,
  getMeals,
  putBodyLog,
  updateMeal,
} from './today.api';

// Bốn deliverable của docs/features/web-today/PLAN.md §4 bước 1 — mock
// `fetch` toàn cục, không gọi server thật (điều phối viên B6: server chưa
// migrate được, test bằng apiClient giả lập).

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(status: number, code: string, message = 'lỗi'): Response {
  return jsonResponse({ error: { code, message } }, status);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('today.api — bước 1 deliverable (a): putBodyLog gửi đúng một khóa', () => {
  it('putBodyLog(d, { weightKg: 1 }) gửi body chỉ chứa weightKg', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ date: '2026-08-07', weightKg: 1 }));

    await putBodyLog('2026-08-07', { weightKg: 1 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ weightKg: 1 });
  });
});

describe('today.api — bước 1 deliverable (b): putBodyLog giữ null, không bỏ khóa', () => {
  it('putBodyLog(d, { waistCm: null }) gửi null chứ không bỏ khóa', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ date: '2026-08-07', waistCm: null }));

    await putBodyLog('2026-08-07', { waistCm: null });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body: unknown = JSON.parse(init.body as string);
    expect(body).toEqual({ waistCm: null });
    expect(body).toHaveProperty('waistCm', null);
  });
});

describe('today.api — bước 1 deliverable (c): getBodyLog trả null khi 404', () => {
  it('404 → null, không ném', async () => {
    fetchMock.mockResolvedValue(errorResponse(404, 'NOT_FOUND', 'Chưa có số đo'));

    const result = await getBodyLog('2026-08-01');

    expect(result).toBeNull();
  });

  it('lỗi khác 404 vẫn ném ApiError', async () => {
    fetchMock.mockResolvedValue(errorResponse(500, 'INTERNAL_ERROR'));

    await expect(getBodyLog('2026-08-01')).rejects.toMatchObject({ status: 500 });
  });
});

describe('today.api — bước 1 deliverable (d): deleteMeal không vỡ khi 204', () => {
  it('204 không body → resolve về undefined', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(deleteMeal('m1')).resolves.toBeUndefined();
  });
});

describe('today.api — các hàm còn lại gọi đúng path/method', () => {
  it('getMeals(date) gọi GET /meals?date=', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await getMeals('2026-08-07');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/meals?date=2026-08-07');
    expect(init.method).toBe('GET');
  });

  it('createMeal gọi POST /meals với đúng body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'm1' }, 201));
    await createMeal({ date: '2026-08-07', slot: 'breakfast', name: 'Phở', calories: 450 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/meals');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      date: '2026-08-07',
      slot: 'breakfast',
      name: 'Phở',
      calories: 450,
    });
  });

  it('updateMeal gọi PATCH /meals/:id với patch', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'm1', calories: 500 }));
    await updateMeal('m1', { calories: 500 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/meals/m1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ calories: 500 });
  });

  it('getGoal gọi GET /goal', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ targetWeightKg: null, targetDate: null, dailyCalorieTarget: null, updatedAt: null }),
    );
    await getGoal();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/goal');
    expect(init.method).toBe('GET');
  });
});
