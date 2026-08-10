import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CalorieSummaryCard } from './CalorieSummaryCard';
import type { Meal } from '../../../types/api';

function makeMeal(calories: number, id = `m-${calories}-${Math.random()}`): Meal {
  return {
    id,
    date: '2026-08-07',
    slot: 'breakfast',
    name: 'Món',
    calories,
    note: null,
    createdAt: '',
    updatedAt: '',
  };
}

describe('CalorieSummaryCard — dailyCalorieTarget = null (PLAN §4 bước 7 #1)', () => {
  it('hiện tổng calo, KHÔNG có thanh tiến độ, có lời mời đặt mục tiêu', () => {
    render(<CalorieSummaryCard meals={[makeMeal(450), makeMeal(600)]} dailyCalorieTarget={null} />);

    expect(screen.getByText('1050 calo')).toBeTruthy();
    expect(screen.getByText(/Đặt mục tiêu calo ở tab Cài đặt/)).toBeTruthy();
    expect(document.querySelector('[class*="barTrack"]')).toBeNull();
  });
});

describe('CalorieSummaryCard — vượt mục tiêu (PLAN §4 bước 7 #2)', () => {
  it('tổng vượt mục tiêu → % không bị cắt ở 100%, thanh đổi màu cảnh báo', () => {
    render(<CalorieSummaryCard meals={[makeMeal(2400)]} dailyCalorieTarget={2000} />);

    expect(screen.getByText('120%')).toBeTruthy();
    expect(screen.getByText('2400 / 2000')).toBeTruthy();

    const fill = document.querySelector('[class*="barFill"]') as HTMLElement;
    expect(fill).toBeTruthy();
    // Class "over" phải có mặt (đổi màu cảnh báo qua CSS Module).
    expect(fill.className).toMatch(/over/);
    // Chiều rộng thanh vẫn bị giới hạn 100% dù % hiển thị là 120.
    expect(fill.style.width).toBe('100%');
  });

  it('chưa vượt mục tiêu → KHÔNG có class "over"', () => {
    render(<CalorieSummaryCard meals={[makeMeal(1000)]} dailyCalorieTarget={2000} />);
    const fill = document.querySelector('[class*="barFill"]') as HTMLElement;
    expect(fill.className).not.toMatch(/over/);
    expect(fill.style.width).toBe('50%');
  });
});

describe('CalorieSummaryCard — ngày trắng cho calo (SPEC §6 nguyên tắc 3, bẫy B2 chung)', () => {
  it('meals rỗng, target đã đặt → KHÔNG hiện "0 / 2000", hiện lời mời nhập', () => {
    render(<CalorieSummaryCard meals={[]} dailyCalorieTarget={2000} />);

    expect(screen.queryByText(/0 \/ 2000/)).toBeNull();
    expect(screen.getByText(/Chưa ghi bữa nào/)).toBeTruthy();
  });

  it('meals rỗng, target null → KHÔNG hiện "0 calo" hay "0 / —", hiện lời mời nhập', () => {
    render(<CalorieSummaryCard meals={[]} dailyCalorieTarget={null} />);

    expect(screen.queryByText(/0 calo/)).toBeNull();
    expect(screen.queryByText(/0 \/ —/)).toBeNull();
    expect(screen.getByText(/Chưa ghi bữa nào/)).toBeTruthy();
  });
});
