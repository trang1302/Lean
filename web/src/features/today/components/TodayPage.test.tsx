import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodayPage } from './TodayPage';
import * as todayApi from '../api/today.api';
import { todayIso } from '../../../lib/format';

vi.mock('../api/today.api', () => ({
  getBodyLog: vi.fn(),
  putBodyLog: vi.fn(),
  getMeals: vi.fn(),
  createMeal: vi.fn(),
  updateMeal: vi.fn(),
  deleteMeal: vi.fn(),
  getGoal: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('TodayPage — ngày trắng hoàn toàn (PLAN §4 bước 7 deliverable #3)', () => {
  it('404 body-log + [] meals + goal null → không hiện "0 kg", không hiện tổng calo 0', async () => {
    vi.mocked(todayApi.getBodyLog).mockResolvedValue(null);
    vi.mocked(todayApi.getMeals).mockResolvedValue([]);
    vi.mocked(todayApi.getGoal).mockResolvedValue({
      startWeightKg: null,
      startDate: null,
      targetWeightKg: null,
      targetWaistCm: null,
      targetChestCm: null,
      targetShoulderCm: null,
      targetArmCm: null,
      targetDate: null,
      dailyCalorieTarget: null,
      updatedAt: null,
    });

    render(<TodayPage />);

    await waitFor(() => expect(todayApi.getBodyLog).toHaveBeenCalledWith(todayIso()));
    await waitFor(() => expect(screen.getByText('Chưa ghi bữa nào cho ngày này.')).toBeTruthy());

    expect((screen.getByLabelText('Cân nặng (kg)') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Vòng bụng (cm)') as HTMLInputElement).value).toBe('');
    expect(screen.queryByText(/0 kg/)).toBeNull();
    expect(screen.queryByText(/0 \/ —/)).toBeNull();
    expect(screen.queryByText(/0 calo/)).toBeNull();
    expect(screen.getByText(/Chưa ghi bữa nào — thêm bữa đầu tiên/)).toBeTruthy();
  });
});

describe('TodayPage — mount gọi ba endpoint song song đúng theo ngày hôm nay', () => {
  it('getBodyLog/getMeals dùng todayIso(), getGoal không nhận tham số', async () => {
    vi.mocked(todayApi.getBodyLog).mockResolvedValue(null);
    vi.mocked(todayApi.getMeals).mockResolvedValue([]);
    vi.mocked(todayApi.getGoal).mockResolvedValue({
      startWeightKg: null,
      startDate: null,
      targetWeightKg: null,
      targetWaistCm: null,
      targetChestCm: null,
      targetShoulderCm: null,
      targetArmCm: null,
      targetDate: null,
      dailyCalorieTarget: 1900,
      updatedAt: null,
    });

    render(<TodayPage />);

    await waitFor(() => expect(todayApi.getGoal).toHaveBeenCalledTimes(1));
    expect(todayApi.getBodyLog).toHaveBeenCalledWith(todayIso());
    expect(todayApi.getMeals).toHaveBeenCalledWith(todayIso());
  });
});

describe('TodayPage — có bữa ăn + mục tiêu → tổng calo và tiến độ hiện đúng', () => {
  it('render tổng calo cộng từ meals, có thanh tiến độ vì goal có dailyCalorieTarget', async () => {
    vi.mocked(todayApi.getBodyLog).mockResolvedValue({
      date: todayIso(),
      weightKg: 70,
      waistCm: 85,
      chestCm: null,
      shoulderCm: null,
      armCm: null,
      note: null,
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(todayApi.getMeals).mockResolvedValue([
      {
        id: 'm1',
        date: todayIso(),
        slot: 'breakfast',
        name: 'Phở',
        calories: 450,
        note: null,
        createdAt: '',
        updatedAt: '',
      },
    ]);
    vi.mocked(todayApi.getGoal).mockResolvedValue({
      startWeightKg: null,
      startDate: null,
      targetWeightKg: null,
      targetWaistCm: null,
      targetChestCm: null,
      targetShoulderCm: null,
      targetArmCm: null,
      targetDate: null,
      dailyCalorieTarget: 1900,
      updatedAt: null,
    });

    render(<TodayPage />);

    await waitFor(() => expect(screen.getByText('450 / 1900')).toBeTruthy());
    // Ba lời gọi (body-log/meals/goal) độc lập nhau (SPEC §2) — không giả
    // định thứ tự resolve giữa chúng, đợi riêng giá trị của BodyLogForm.
    await waitFor(() =>
      expect((screen.getByLabelText('Cân nặng (kg)') as HTMLInputElement).value).toBe('70'),
    );
    expect((screen.getByLabelText('Vòng bụng (cm)') as HTMLInputElement).value).toBe('85');
  });
});
