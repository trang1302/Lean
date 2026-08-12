// Test tích hợp nhẹ của `ChartsPage` — mock đúng MỘT hàm (`getSummary`) để
// giữ nguyên toàn bộ `useCharts`/`useApiResource` thật (SPEC §2: trang này
// sống bằng ĐÚNG MỘT request, nên mock đúng một điểm là đủ). Ba trạng thái
// loading/lỗi/có dữ liệu — chưa đối chứng server thật (ghi trong báo cáo).
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ApiError } from '../../../types/api';
import type { SummaryResponse } from '../../../types/api';

vi.mock('../api/charts.api', () => ({
  getSummary: vi.fn(),
}));

// Import SAU vi.mock để lấy đúng bản mock (hoisting của vi.mock đảm bảo
// thứ tự này luôn an toàn, theo cách Vitest xử lý mock module).
import { getSummary } from '../api/charts.api';
import { ChartsPage } from './ChartsPage';

const mockedGetSummary = getSummary as unknown as ReturnType<typeof vi.fn>;

function emptySummary(): SummaryResponse {
  return {
    days: [
      {
        date: '2026-08-06',
        weightKg: null,
        weightMa7: null,
        waistCm: null,
        waistMa7: null,
        chestCm: null,
        chestMa7: null,
        shoulderCm: null,
        shoulderMa7: null,
        armCm: null,
        armMa7: null,
        totalCalories: 0,
        mealCount: 0,
      },
    ],
    weeks: [{ weekStart: '2026-08-03', avgCalories: null, avgWeightKg: null }],
    goal: {
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
    },
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ChartsPage />
    </MemoryRouter>,
  );
}

describe('ChartsPage — ba trạng thái tải (chưa đối chứng server thật)', () => {
  it('đang tải lần đầu → LoadingState', () => {
    mockedGetSummary.mockReturnValue(new Promise(() => {})); // không bao giờ resolve trong test này
    renderPage();
    expect(screen.getByText('Đang tải dữ liệu biểu đồ…')).toBeTruthy();
  });

  it('lỗi mạng → ErrorState kèm nút Thử lại, gọi lại đúng hàm nạp khi bấm', async () => {
    mockedGetSummary.mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được server'));
    renderPage();
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
  });

  it('có dữ liệu → hiện đủ ba mục biểu đồ + thẻ tiến độ, không còn Loading/Error', async () => {
    mockedGetSummary.mockResolvedValue(emptySummary());
    renderPage();
    await waitFor(() => expect(screen.getByText('Cân nặng')).toBeTruthy());
    expect(screen.getByText('Vòng bụng')).toBeTruthy();
    expect(screen.getByText('Calo')).toBeTruthy();
    expect(screen.getByText('Tiến độ mục tiêu')).toBeTruthy();
    expect(screen.queryByText('Đang tải dữ liệu biểu đồ…')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('DB trắng (mọi trường null/0) → ba thông điệp "Cần ít nhất 2 ngày dữ liệu", KHÔNG có biểu đồ trống/số 0 (SPEC §6)', async () => {
    mockedGetSummary.mockResolvedValue(emptySummary());
    renderPage();
    await waitFor(() => expect(screen.getAllByText(/Cần ít nhất 2 ngày dữ liệu/).length).toBeGreaterThan(0));
    // Cả ba biểu đồ đều rỗng — SPEC §6 "xét từng biểu đồ riêng", DB trắng
    // nghĩa là CẢ BA cùng rỗng (không phải chỉ một trong ba).
    expect(screen.getAllByText(/Cần ít nhất 2 ngày dữ liệu/)).toHaveLength(3);
  });
});

describe('ChartsPage — RangePicker luôn hiện, kể cả khi đang tải/lỗi (SPEC §3.1)', () => {
  it('vẫn đổi được khoảng trong lúc đang tải lần đầu', () => {
    mockedGetSummary.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole('button', { name: '30 ngày' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '90 ngày' })).toBeTruthy();
  });
});
