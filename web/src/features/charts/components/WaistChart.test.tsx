// `WaistChart` lặp lại `WeightChart` có chủ đích (PLAN §2) — test ở đây tập
// trung vào điểm KHÁC BIỆT thật (không có ReferenceLine, SPEC §3.3) và một
// lần kiểm lại nhanh hai cạm bẫy §4.1/§4.2 để chắc bản sao không lệch bản
// gốc (test đầy đủ, chi tiết từng bước đã nằm ở `WeightChart.test.tsx`).
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { SummaryDay } from '../../../types/api';
import { WaistChart } from './WaistChart';

function day(overrides: Partial<SummaryDay> & { date: string }): SummaryDay {
  return {
    weightKg: null,
    weightMa7: null,
    waistCm: null,
    waistMa7: null,
    totalCalories: 0,
    mealCount: 0,
    ...overrides,
  };
}

const DIMS = { width: 600, height: 300 };

describe('WaistChart — KHÔNG có ReferenceLine mục tiêu (SPEC §3.3)', () => {
  it('không nhận prop mục tiêu nào, và DOM không có .recharts-reference-line dù dữ liệu đủ để vẽ', () => {
    const days = [
      day({ date: '2026-08-01', waistCm: 85 }),
      day({ date: '2026-08-02', waistCm: 84.5 }),
    ];
    const { container } = render(<WaistChart days={days} testDimensions={DIMS} />);
    expect(container.querySelector('.recharts-reference-line')).toBeNull();
  });
});

describe('WaistChart — trạng thái rỗng (SPEC §6), độc lập với biểu đồ cân nặng', () => {
  it('dưới 2 ngày có waistCm thật → ChartEmptyState', () => {
    const days = [day({ date: '2026-08-01', waistCm: 85 })];
    const { getByText } = render(<WaistChart days={days} testDimensions={DIMS} />);
    expect(getByText(/Cần ít nhất 2 ngày dữ liệu/)).toBeTruthy();
  });

  it('có đủ waistCm nhưng KHÔNG có weightKg nào vẫn vẽ được — hai biểu đồ xét rỗng độc lập (SPEC §6: "Xét từng biểu đồ riêng")', () => {
    const days = [
      day({ date: '2026-08-01', waistCm: 85, weightKg: null }),
      day({ date: '2026-08-02', waistCm: 84.5, weightKg: null }),
    ];
    const { queryByText, container } = render(<WaistChart days={days} testDimensions={DIMS} />);
    expect(queryByText(/Cần ít nhất 2 ngày dữ liệu/)).toBeNull();
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(2);
  });
});

describe('WaistChart — cạm bẫy §4.1/§4.2 áp dụng y nguyên như WeightChart', () => {
  it('Line điểm thô (waistCm) khai TRƯỚC Line MA7 (waistMa7) trong DOM', () => {
    const days = [
      day({ date: '2026-08-01', waistCm: 85, waistMa7: null }),
      day({ date: '2026-08-02', waistCm: 84.5, waistMa7: 84.75 }),
    ];
    const { container } = render(<WaistChart days={days} testDimensions={DIMS} />);
    const groups = Array.from(container.querySelectorAll('.recharts-line'));
    const classes = groups.map((g) => g.getAttribute('class') ?? '');
    const rawIndex = classes.findIndex((c) => c.includes('chart-line-raw'));
    const ma7Index = classes.findIndex((c) => c.includes('chart-line-ma7'));
    expect(ma7Index).toBeGreaterThan(rawIndex);
  });

  it('waistMa7 === null giữa hai điểm thật → đường MA7 ngắt đoạn (connectNulls={false})', () => {
    const days = [
      day({ date: '2026-08-01', waistCm: 85, waistMa7: 85 }),
      day({ date: '2026-08-02', waistCm: null, waistMa7: null }),
      day({ date: '2026-08-03', waistCm: null, waistMa7: null }),
      day({ date: '2026-08-04', waistCm: 84, waistMa7: 84.5 }),
    ];
    const { container } = render(<WaistChart days={days} testDimensions={DIMS} />);
    const ma7Path = container.querySelector('.chart-line-ma7 path.recharts-curve');
    const d = ma7Path?.getAttribute('d') ?? '';
    const moveCommandCount = (d.match(/M/g) ?? []).length;
    expect(moveCommandCount).toBeGreaterThan(1);
  });
});
