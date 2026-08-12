// Test render THẬT của `WeightChart` — không chỉ hàm thuần. Đây là chỗ
// canh cạm bẫy §4.1 (MA7 phải nổi bật hơn điểm thô, thứ tự vẽ) và §4.2
// (weightMa7 === null phải ngắt đoạn) TRÊN CHÍNH SVG được vẽ ra, không chỉ
// trên dữ liệu đầu vào.
//
// Dùng `testDimensions` để bỏ qua `ResponsiveContainer` — jsdom không có
// layout thật (`ResizeObserver`/`getBoundingClientRect` đều trả 0), đã xác
// nhận bằng một spike thủ công trước khi viết component (ghi trong báo
// cáo): `ResponsiveContainer` trong jsdom render ra một `<div>` rộng 0px,
// không có gì bên trong để kiểm. Render thẳng `ComposedChart` với
// width/height cố định vẫn ra SVG path/g thật, kiểm được.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { SummaryDay } from '../../../types/api';
import { WeightChart } from './WeightChart';

function day(overrides: Partial<SummaryDay> & { date: string }): SummaryDay {
  return {
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
    ...overrides,
  };
}

const DIMS = { width: 600, height: 300 };

describe('WeightChart — trạng thái rỗng (SPEC §6)', () => {
  it('dưới 2 ngày có weightKg thật → hiện ChartEmptyState, KHÔNG vẽ biểu đồ', () => {
    const days = [day({ date: '2026-08-01', weightKg: 70 })];
    const { container, getByText } = render(
      <WeightChart days={days} targetWeightKg={null} testDimensions={DIMS} />,
    );
    expect(getByText(/Cần ít nhất 2 ngày dữ liệu/)).toBeTruthy();
    expect(container.querySelector('.recharts-wrapper, svg.recharts-surface')).toBeNull();
  });

  it('đúng 2 ngày có weightKg thật → vẽ biểu đồ (không còn là trạng thái rỗng)', () => {
    const days = [
      day({ date: '2026-08-01', weightKg: 70 }),
      day({ date: '2026-08-02', weightKg: 70.5 }),
    ];
    const { container, queryByText } = render(
      <WeightChart days={days} targetWeightKg={null} testDimensions={DIMS} />,
    );
    expect(queryByText(/Cần ít nhất 2 ngày dữ liệu/)).toBeNull();
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(2);
  });
});

describe('WeightChart — cạm bẫy §4.1: MA7 phải nổi bật hơn điểm thô', () => {
  const days = [
    day({ date: '2026-08-01', weightKg: 71.2, weightMa7: null }),
    day({ date: '2026-08-02', weightKg: 70.1, weightMa7: 70.65 }),
  ];

  it('Line điểm thô nằm TRƯỚC Line MA7 trong DOM (thứ tự khai báo → thứ tự vẽ, SPEC §4.1)', () => {
    const { container } = render(
      <WeightChart days={days} targetWeightKg={null} testDimensions={DIMS} />,
    );
    const groups = Array.from(container.querySelectorAll('.recharts-line'));
    const classes = groups.map((g) => g.getAttribute('class') ?? '');
    const rawIndex = classes.findIndex((c) => c.includes('chart-line-raw'));
    const ma7Index = classes.findIndex((c) => c.includes('chart-line-ma7'));
    expect(rawIndex).toBeGreaterThanOrEqual(0);
    expect(ma7Index).toBeGreaterThan(rawIndex);
  });

  it('đường MA7 vẽ đậm hơn điểm thô: strokeWidth lớn hơn và không mờ (opacity 1, khác điểm thô)', () => {
    const { container } = render(
      <WeightChart days={days} targetWeightKg={null} testDimensions={DIMS} />,
    );
    const rawPath = container.querySelector('.chart-line-raw path.recharts-curve');
    const ma7Path = container.querySelector('.chart-line-ma7 path.recharts-curve');
    expect(rawPath).toBeTruthy();
    expect(ma7Path).toBeTruthy();

    const rawWidth = Number(rawPath?.getAttribute('stroke-width'));
    const ma7Width = Number(ma7Path?.getAttribute('stroke-width'));
    expect(ma7Width).toBeGreaterThan(rawWidth);

    // Điểm thô phải mờ (SPEC §4.1: opacity ~0.25–0.35) — MA7 không đặt
    // `strokeOpacity` nên Recharts không render thuộc tính này (mờ đục).
    const rawOpacity = Number(rawPath?.getAttribute('stroke-opacity'));
    expect(rawOpacity).toBeLessThan(0.5);
    expect(ma7Path?.getAttribute('stroke-opacity')).toBeNull();
  });
});

describe('WeightChart — cạm bẫy §4.2: weightMa7 === null phải ngắt đoạn, không nội suy', () => {
  it('connectNulls={false} tường minh trên cả hai Line — đường MA7 để lại lỗ hổng thay vì nối thẳng qua ngày null', () => {
    // 5 ngày liên tiếp, 2 ngày đầu có MA7 thật, 3 ngày sau null (giả lập
    // "nghỉ cân vài ngày" — đúng kịch bản PLAN bước 3 mô tả).
    const gappedDays = [
      day({ date: '2026-08-01', weightKg: 70, weightMa7: 70 }),
      day({ date: '2026-08-02', weightKg: 70.2, weightMa7: 70.1 }),
      day({ date: '2026-08-03', weightKg: null, weightMa7: null }),
      day({ date: '2026-08-04', weightKg: null, weightMa7: null }),
      day({ date: '2026-08-05', weightKg: 71, weightMa7: 70.5 }),
    ];
    const { container } = render(
      <WeightChart days={gappedDays} targetWeightKg={null} testDimensions={DIMS} />,
    );
    const ma7Path = container.querySelector('.chart-line-ma7 path.recharts-curve');
    const d = ma7Path?.getAttribute('d') ?? '';
    // Một đường KHÔNG ngắt đoạn chỉ có đúng một lệnh "M" (move-to) ở đầu.
    // Ngắt đoạn thật sự tạo ra NHIỀU đoạn "M" độc lập trong cùng path `d`
    // (Recharts vẽ mỗi đoạn liên tục là một sub-path riêng khi gặp `null`).
    const moveCommandCount = (d.match(/M/g) ?? []).length;
    expect(moveCommandCount).toBeGreaterThan(1);
  });
});

describe('WeightChart — ReferenceLine mục tiêu (SPEC §3.2)', () => {
  const days = [
    day({ date: '2026-08-01', weightKg: 71 }),
    day({ date: '2026-08-02', weightKg: 70 }),
  ];

  it('targetWeightKg !== null → có ReferenceLine', () => {
    const { container } = render(
      <WeightChart days={days} targetWeightKg={65} testDimensions={DIMS} />,
    );
    expect(container.querySelector('.recharts-reference-line')).toBeTruthy();
  });

  it('targetWeightKg === null → KHÔNG vỡ, không có ReferenceLine nào', () => {
    const { container } = render(
      <WeightChart days={days} targetWeightKg={null} testDimensions={DIMS} />,
    );
    expect(container.querySelector('.recharts-reference-line')).toBeNull();
  });
});
