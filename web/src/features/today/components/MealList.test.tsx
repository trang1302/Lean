import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MealList } from './MealList';
import type { Meal } from '../../../types/api';

function makeMeal(overrides: Partial<Meal>): Meal {
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

describe('MealList — thứ tự hiển thị KHÔNG phụ thuộc thứ tự server trả (SPEC §5.3, khóa hợp đồng)', () => {
  it('mảng trả về [dinner, breakfast] → render sáng TRƯỚC, tối SAU', () => {
    const meals: Meal[] = [
      makeMeal({ id: 'm-dinner', slot: 'dinner', name: 'Cơm gà nướng' }),
      makeMeal({ id: 'm-breakfast', slot: 'breakfast', name: 'Phở bò' }),
    ];
    render(<MealList meals={meals} onChanged={() => {}} />);

    const names = screen.getAllByText(/Phở bò|Cơm gà nướng/).map((el) => el.textContent);
    const breakfastIndex = names.indexOf('Phở bò');
    const dinnerIndex = names.indexOf('Cơm gà nướng');

    expect(breakfastIndex).toBeGreaterThanOrEqual(0);
    expect(dinnerIndex).toBeGreaterThan(breakfastIndex);
  });

  it('hiện đủ 4 tiêu đề buổi dù chỉ có bữa sáng (SPEC §7 câu hỏi 5)', () => {
    render(<MealList meals={[makeMeal({ slot: 'breakfast' })]} onChanged={() => {}} />);
    expect(screen.getByText('Sáng')).toBeTruthy();
    expect(screen.getByText('Trưa')).toBeTruthy();
    expect(screen.getByText('Tối')).toBeTruthy();
    expect(screen.getByText('Phụ')).toBeTruthy();
  });
});

describe('MealList — mảng rỗng (bẫy B2 #3 chung, SPEC §6)', () => {
  it('rỗng → "Chưa ghi bữa nào cho ngày này.", KHÔNG render bảng trống', () => {
    render(<MealList meals={[]} onChanged={() => {}} />);
    expect(screen.getByText('Chưa ghi bữa nào cho ngày này.')).toBeTruthy();
    expect(screen.queryByText('Sáng')).toBeNull();
  });
});

describe('MealList — dùng MEAL_SLOTS, không phải orderBy của server (bẫy B2 #3)', () => {
  it('nhiều bữa cùng buổi giữ nguyên thứ tự createdAt server trả (không sort lại trong nhóm)', () => {
    const meals: Meal[] = [
      makeMeal({ id: 'm1', slot: 'lunch', name: 'Cơm gà', createdAt: '2026-08-07T01:00:00.000Z' }),
      makeMeal({ id: 'm2', slot: 'lunch', name: 'Bún chả', createdAt: '2026-08-07T02:00:00.000Z' }),
    ];
    render(<MealList meals={meals} onChanged={vi.fn()} />);

    const names = screen.getAllByText(/Cơm gà|Bún chả/).map((el) => el.textContent);
    expect(names.indexOf('Cơm gà')).toBeLessThan(names.indexOf('Bún chả'));
  });
});
