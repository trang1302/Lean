import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTodayData } from './useTodayData';
import * as todayApi from '../api/today.api';
import type { BodyLog, Goal, Meal } from '../../../types/api';

// PLAN §4 bước 4 deliverable: đổi `date` hai lần liên tiếp, response của
// ngày cũ về SAU nhưng state phải mang dữ liệu của ngày mới; `getGoal`
// KHÔNG được gọi lại khi chỉ đổi `date`.

vi.mock('../api/today.api', () => ({
  getBodyLog: vi.fn(),
  getMeals: vi.fn(),
  getGoal: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

function goal(overrides: Partial<Goal> = {}): Goal {
  return { targetWeightKg: null, targetDate: null, dailyCalorieTarget: null, updatedAt: null, ...overrides };
}

describe('useTodayData — chống race khi đổi date liên tiếp', () => {
  it('response của ngày CŨ về SAU response của ngày MỚI → state mang dữ liệu ngày MỚI', async () => {
    const bodyLogResolvers = new Map<string, (v: BodyLog | null) => void>();
    vi.mocked(todayApi.getBodyLog).mockImplementation(
      (date: string) =>
        new Promise((resolve) => {
          bodyLogResolvers.set(date, resolve);
        }),
    );
    vi.mocked(todayApi.getMeals).mockResolvedValue([]);
    vi.mocked(todayApi.getGoal).mockResolvedValue(goal());

    const { result, rerender } = renderHook(({ date }: { date: string }) => useTodayData(date), {
      initialProps: { date: '2026-08-06' },
    });

    rerender({ date: '2026-08-07' });

    act(() => bodyLogResolvers.get('2026-08-07')?.({
      date: '2026-08-07',
      weightKg: 71,
      waistCm: null,
      note: null,
      createdAt: '',
      updatedAt: '',
    }));
    await waitFor(() => expect(result.current.bodyLog?.weightKg).toBe(71));

    act(() => bodyLogResolvers.get('2026-08-06')?.({
      date: '2026-08-06',
      weightKg: 999,
      waistCm: null,
      note: null,
      createdAt: '',
      updatedAt: '',
    }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.bodyLog?.weightKg).toBe(71);
  });
});

describe('useTodayData — goal không phụ thuộc date', () => {
  it('đổi date nhiều lần → getGoal chỉ gọi đúng một lần (lúc mount)', async () => {
    vi.mocked(todayApi.getBodyLog).mockResolvedValue(null);
    vi.mocked(todayApi.getMeals).mockResolvedValue([] as Meal[]);
    vi.mocked(todayApi.getGoal).mockResolvedValue(goal({ dailyCalorieTarget: 1900 }));

    const { result, rerender } = renderHook(({ date }: { date: string }) => useTodayData(date), {
      initialProps: { date: '2026-08-05' },
    });

    await waitFor(() => expect(result.current.goal?.dailyCalorieTarget).toBe(1900));

    rerender({ date: '2026-08-06' });
    await waitFor(() => expect(result.current.bodyLogLoading).toBe(false));
    rerender({ date: '2026-08-07' });
    await waitFor(() => expect(result.current.bodyLogLoading).toBe(false));

    expect(todayApi.getGoal).toHaveBeenCalledTimes(1);
    expect(todayApi.getBodyLog).toHaveBeenCalledTimes(3);
    expect(todayApi.getMeals).toHaveBeenCalledTimes(3);
  });
});
