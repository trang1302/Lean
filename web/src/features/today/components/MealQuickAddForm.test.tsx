import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MealQuickAddForm } from './MealQuickAddForm';
import * as todayApi from '../api/today.api';
import { ApiError } from '../../../types/api';

vi.mock('../api/today.api', () => ({
  createMeal: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('MealQuickAddForm — gửi bữa hợp lệ (PLAN §4 bước 6)', () => {
  it('gõ tên + calo, bấm + → createMeal nhận payload đúng kiểu (calories là number)', async () => {
    vi.mocked(todayApi.createMeal).mockResolvedValue({
      id: 'm1',
      date: '2026-08-07',
      slot: 'breakfast',
      name: 'Phở',
      calories: 450,
      note: null,
      createdAt: '',
      updatedAt: '',
    });
    const user = userEvent.setup();
    render(<MealQuickAddForm date="2026-08-07" onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText('Tên món'), 'Phở');
    await user.type(screen.getByLabelText('Calo'), '450');
    await user.click(screen.getByText('+'));

    await waitFor(() => expect(todayApi.createMeal).toHaveBeenCalledTimes(1));
    expect(todayApi.createMeal).toHaveBeenCalledWith({
      date: '2026-08-07',
      slot: 'breakfast',
      name: 'Phở',
      calories: 450,
    });
    expect(typeof (vi.mocked(todayApi.createMeal).mock.calls[0]?.[0] as { calories: unknown }).calories).toBe(
      'number',
    );
  });

  it('sau khi 201 → xóa trắng tên+calo, GIỮ NGUYÊN buổi, focus về ô tên món', async () => {
    vi.mocked(todayApi.createMeal).mockResolvedValue({
      id: 'm1',
      date: '2026-08-07',
      slot: 'lunch',
      name: 'Cơm gà',
      calories: 600,
      note: null,
      createdAt: '',
      updatedAt: '',
    });
    const user = userEvent.setup();
    render(<MealQuickAddForm date="2026-08-07" onCreated={vi.fn()} />);

    const slotSelect = screen.getByLabelText('Buổi') as HTMLSelectElement;
    await user.selectOptions(slotSelect, 'lunch');
    await user.type(screen.getByLabelText('Tên món'), 'Cơm gà');
    await user.type(screen.getByLabelText('Calo'), '600');
    await user.click(screen.getByText('+'));

    await waitFor(() => expect(todayApi.createMeal).toHaveBeenCalledTimes(1));

    await waitFor(() => expect((screen.getByLabelText('Tên món') as HTMLInputElement).value).toBe(''));
    expect((screen.getByLabelText('Calo') as HTMLInputElement).value).toBe('');
    expect(slotSelect.value).toBe('lunch');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Tên món')));
  });
});

describe('MealQuickAddForm — tên rỗng chặn ở client (PLAN §4 bước 6)', () => {
  it('tên rỗng, bấm + → KHÔNG gọi API, hiện lỗi dưới ô tên', async () => {
    const user = userEvent.setup();
    render(<MealQuickAddForm date="2026-08-07" onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText('Calo'), '450');
    await user.click(screen.getByText('+'));

    expect(todayApi.createMeal).not.toHaveBeenCalled();
    expect(screen.getByText('Nhập tên món')).toBeTruthy();
  });
});

describe('MealQuickAddForm — lỗi 400 từ server gắn đúng ô theo path (bẫy B2 #4)', () => {
  it('server trả 400 fields calories → lỗi hiện dưới ô Calo', async () => {
    vi.mocked(todayApi.createMeal).mockRejectedValue(
      new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu gửi lên không hợp lệ', [
        { path: 'calories', message: 'phải là số nguyên' },
      ]),
    );
    const user = userEvent.setup();
    render(<MealQuickAddForm date="2026-08-07" onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText('Tên món'), 'Phở');
    await user.type(screen.getByLabelText('Calo'), '450');
    await user.click(screen.getByText('+'));

    await waitFor(() => expect(screen.getByText('phải là số nguyên')).toBeTruthy());
  });
});
