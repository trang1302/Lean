import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MealRow } from './MealRow';
import * as todayApi from '../api/today.api';
import { ApiError } from '../../../types/api';
import type { Meal } from '../../../types/api';

vi.mock('../api/today.api', () => ({
  updateMeal: vi.fn(),
  deleteMeal: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

function makeMeal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: 'm1',
    date: '2026-08-07',
    slot: 'breakfast',
    name: 'Phở',
    calories: 450,
    note: null,
    createdAt: '2026-08-07T00:00:00.000Z',
    updatedAt: '2026-08-07T00:00:00.000Z',
    ...overrides,
  };
}

describe('MealRow — xóa hai lần nhanh chỉ gọi deleteMeal MỘT lần (PLAN §4 bước 5 deliverable #3)', () => {
  it('bấm xóa hai lần liên tiếp (không chờ) → deleteMeal được gọi đúng 1 lần', async () => {
    let resolveDelete!: () => void;
    vi.mocked(todayApi.deleteMeal).mockReturnValue(
      new Promise((resolve) => {
        resolveDelete = () => resolve(undefined);
      }),
    );
    const user = userEvent.setup();
    render(<MealRow meal={makeMeal()} onChanged={vi.fn()} />);

    const deleteButton = screen.getByText('Xóa');
    await user.click(deleteButton);
    await user.click(deleteButton);

    resolveDelete();
    await waitFor(() => expect(todayApi.deleteMeal).toHaveBeenCalledTimes(1));
  });
});

describe('MealRow — xóa nhận 404 coi như đã xóa xong, không báo lỗi đỏ (SPEC §5.4)', () => {
  it('deleteMeal ném 404 → gọi onChanged(), không render role="alert"', async () => {
    vi.mocked(todayApi.deleteMeal).mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'Không tìm thấy'));
    const onChanged = vi.fn();
    const user = userEvent.setup();
    render(<MealRow meal={makeMeal()} onChanged={onChanged} />);

    await user.click(screen.getByText('Xóa'));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('MealRow — sửa inline chỉ gửi các trường THỰC SỰ đổi (SPEC §5.4)', () => {
  it('chỉ đổi calories → PATCH chỉ chứa calories, không chứa name/slot', async () => {
    vi.mocked(todayApi.updateMeal).mockResolvedValue(makeMeal({ calories: 500 }));
    const user = userEvent.setup();
    render(<MealRow meal={makeMeal()} onChanged={vi.fn()} />);

    await user.click(screen.getByText('Sửa'));
    const caloriesInput = screen.getByLabelText('Calo');
    await user.clear(caloriesInput);
    await user.type(caloriesInput, '500');
    await user.click(screen.getByText('Lưu'));

    await waitFor(() => expect(todayApi.updateMeal).toHaveBeenCalledTimes(1));
    expect(todayApi.updateMeal).toHaveBeenCalledWith('m1', { calories: 500 });
  });

  it('không đổi gì rồi bấm Lưu → KHÔNG gọi updateMeal (tránh PATCH {} vô nghĩa)', async () => {
    const user = userEvent.setup();
    render(<MealRow meal={makeMeal()} onChanged={vi.fn()} />);

    await user.click(screen.getByText('Sửa'));
    await user.click(screen.getByText('Lưu'));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(todayApi.updateMeal).not.toHaveBeenCalled();
  });

  it('xóa trắng tên món rồi bấm Lưu → chặn ở client, không gọi API', async () => {
    const user = userEvent.setup();
    render(<MealRow meal={makeMeal()} onChanged={vi.fn()} />);

    await user.click(screen.getByText('Sửa'));
    const nameInput = screen.getByLabelText('Tên món');
    await user.clear(nameInput);
    await user.click(screen.getByText('Lưu'));

    expect(todayApi.updateMeal).not.toHaveBeenCalled();
    expect(screen.getByText('Nhập tên món')).toBeTruthy();
  });
});
