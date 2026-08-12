// Test render của thẻ tiến độ mục tiêu — canh ba điều SPEC §2.4 bắt buộc:
// `onTrack` có BA trạng thái, `remainingKg` không tự suy hướng, và thẻ phải
// ghi rõ nó neo vào HÔM NAY (không phải khoảng đang xem).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { SummaryGoal } from '../../../types/api';
import { GoalProgressCard } from './GoalProgressCard';

function goal(overrides: Partial<SummaryGoal> = {}): SummaryGoal {
  return {
    startWeightKg: null,
    startDate: null,
    targetWeightKg: null,
    targetDate: null,
    dailyCalorieTarget: null,
    currentMa7WeightKg: null,
    remainingKg: null,
    currentRateKgPerWeek: null,
    requiredRateKgPerWeek: null,
    onTrack: null,
    ...overrides,
  };
}

function renderCard(g: SummaryGoal) {
  return render(
    <MemoryRouter>
      <GoalProgressCard goal={g} />
    </MemoryRouter>,
  );
}

describe('GoalProgressCard — neo vào hôm nay (SPEC §2.4)', () => {
  it('luôn hiện câu ghi rõ "hôm nay", không phụ thuộc trạng thái mục tiêu', () => {
    renderCard(goal());
    expect(screen.getByText(/hôm nay/i)).toBeTruthy();
  });
});

describe('GoalProgressCard — ba tình huống của PLAN bước 7', () => {
  it('chưa có số đo cân nặng gần đây (currentMa7WeightKg === null) → mời ghi thêm, KHÔNG hiện NaN/0 giả', () => {
    renderCard(goal({ currentMa7WeightKg: null, targetWeightKg: 65 }));
    expect(screen.getByText(/Chưa đủ số đo cân nặng trong 7 ngày gần nhất/)).toBeTruthy();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it('có số đo nhưng CHƯA đặt mục tiêu → vẫn hiện "hiện tại"/"tốc độ", kèm lời mời đặt mục tiêu (SPEC §2.4, quyết định vượt spec 6.1 của backend)', () => {
    renderCard(goal({ currentMa7WeightKg: 73, currentRateKgPerWeek: -0.4, targetWeightKg: null }));
    expect(screen.getByText(/73/)).toBeTruthy();
    expect(screen.getByText(/Chưa đặt mục tiêu/)).toBeTruthy();
    // Không có phần "còn lại"/"tốc độ cần thiết" khi chưa có mục tiêu.
    expect(screen.queryByText('Còn lại')).toBeNull();
  });

  it('đủ dữ liệu và đã đặt mục tiêu → hiện đủ remainingKg/tốc độ cần thiết/badge, KHÔNG còn lời mời đặt mục tiêu', () => {
    renderCard(
      goal({
        currentMa7WeightKg: 73,
        currentRateKgPerWeek: -0.4,
        targetWeightKg: 65,
        targetDate: '2026-12-31',
        remainingKg: 8,
        requiredRateKgPerWeek: -0.3,
        onTrack: true,
      }),
    );
    expect(screen.getByText('Còn lại')).toBeTruthy();
    expect(screen.queryByText(/Chưa đặt mục tiêu/)).toBeNull();
  });
});

describe('GoalProgressCard — onTrack có BA trạng thái (SPEC §2.4)', () => {
  const base = {
    currentMa7WeightKg: 73,
    currentRateKgPerWeek: -0.4,
    targetWeightKg: 65,
    remainingKg: 8,
    requiredRateKgPerWeek: -0.3,
  };

  it('onTrack: true → badge "Đúng tiến độ"', () => {
    renderCard(goal({ ...base, onTrack: true }));
    expect(screen.getByText('Đúng tiến độ')).toBeTruthy();
  });

  it('onTrack: false → badge "Chưa đúng tiến độ" — KHÁC câu chữ của null', () => {
    renderCard(goal({ ...base, onTrack: false }));
    expect(screen.getByText('Chưa đúng tiến độ')).toBeTruthy();
  });

  it('onTrack: null → badge "Chưa đủ dữ liệu để kết luận" — KHÔNG được hiện như false', () => {
    renderCard(goal({ ...base, onTrack: null }));
    expect(screen.getByText('Chưa đủ dữ liệu để kết luận')).toBeTruthy();
    expect(screen.queryByText('Chưa đúng tiến độ')).toBeNull();
    expect(screen.queryByText('Đúng tiến độ')).toBeNull();
  });
});
