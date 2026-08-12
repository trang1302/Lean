// Test render THẬT của `CaloriesChart` — canh cạm bẫy §4.3 (avgCalories ===
// null khác hẳn 0, đường trung bình tuần phải NGẮT ĐOẠN) và §5.1 (trục Y
// của cột calo bắt đầu từ 0, ngược lại với cân nặng/vòng bụng).
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { SummaryDay, SummaryWeek } from '../../../types/api';
import { buildCaloriesTooltipRows, CaloriesChart } from './CaloriesChart';

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

function week(overrides: Partial<SummaryWeek> & { weekStart: string }): SummaryWeek {
  return { avgCalories: null, avgWeightKg: null, ...overrides };
}

const DIMS = { width: 700, height: 300 };

describe('CaloriesChart — trạng thái rỗng (SPEC §6)', () => {
  it('mọi ngày mealCount === 0 → ChartEmptyState, KHÔNG vẽ cột 0 nào', () => {
    const days = [day({ date: '2026-08-01' }), day({ date: '2026-08-02' })];
    const { getByText, container } = render(
      <CaloriesChart days={days} weeks={[]} from="2026-08-01" to="2026-08-02" dailyCalorieTarget={null} testDimensions={DIMS} />,
    );
    expect(getByText(/Cần ít nhất 2 ngày dữ liệu/)).toBeTruthy();
    expect(container.querySelector('.chart-bar-calories')).toBeNull();
  });

  it('ít nhất một ngày có mealCount > 0 → vẽ biểu đồ', () => {
    const days = [
      day({ date: '2026-08-01' }),
      day({ date: '2026-08-02', totalCalories: 1800, mealCount: 3 }),
    ];
    const { queryByText, container } = render(
      <CaloriesChart days={days} weeks={[]} from="2026-08-01" to="2026-08-02" dailyCalorieTarget={null} testDimensions={DIMS} />,
    );
    expect(queryByText(/Cần ít nhất 2 ngày dữ liệu/)).toBeNull();
    expect(container.querySelectorAll('.recharts-bar-rectangle').length).toBeGreaterThan(0);
  });
});

describe('CaloriesChart — cạm bẫy §4.3: avgCalories === null khác hẳn 0, đường tuần phải ngắt đoạn', () => {
  it('tuần GIỮA không ghi bữa nào (avgCalories: null) → đường trung bình tuần có lỗ hổng, không nối liền tuần trước với tuần sau', () => {
    // BA tuần liên tiếp, tuần GIỮA rỗng — đặt lỗ hổng ở giữa (không phải ở
    // đầu/cuối chuỗi) để buộc Recharts phải QUYẾT ĐỊNH có nối qua nó hay
    // không (một lỗ hổng ở cuối chuỗi không có điểm nào sau nó để nối, nên
    // không phân biệt được "nối" và "không nối" — không phải test đúng).
    // `to` trải hết tuần 3 (2026-08-23) để tuần rỗng không bị
    // `dropTruncatedWeeks` (§4.4) loại vì lý do KHÁC (cắt cụt) — ta đang
    // kiểm đúng lý do avgCalories === null (§4.3).
    const days = [
      day({ date: '2026-08-03', totalCalories: 1800, mealCount: 3 }), // tuần 1
      day({ date: '2026-08-04', totalCalories: 1700, mealCount: 3 }),
      day({ date: '2026-08-10', totalCalories: 0, mealCount: 0 }), // tuần 2 — rỗng
      day({ date: '2026-08-11', totalCalories: 0, mealCount: 0 }),
      day({ date: '2026-08-17', totalCalories: 1600, mealCount: 3 }), // tuần 3
      day({ date: '2026-08-18', totalCalories: 1650, mealCount: 3 }),
    ];
    const weeks = [
      week({ weekStart: '2026-08-03', avgCalories: 1750 }),
      week({ weekStart: '2026-08-10', avgCalories: null }),
      week({ weekStart: '2026-08-17', avgCalories: 1625 }),
    ];
    const { container } = render(
      <CaloriesChart
        days={days}
        weeks={weeks}
        from="2026-08-03"
        to="2026-08-23"
        dailyCalorieTarget={null}
        testDimensions={DIMS}
      />,
    );
    const weeklyPath = container.querySelector('.chart-line-weekly-avg path.recharts-curve');
    expect(weeklyPath).toBeTruthy();
    const d = weeklyPath?.getAttribute('d') ?? '';
    // Ngắt đoạn thật sự (connectNulls={false}) tạo ra NHIỀU sub-path "M" —
    // đúng một "M" nghĩa là đã bị nối liền qua tuần null (SAI, hồi quy cạm
    // bẫy §4.3).
    const moveCommandCount = (d.match(/M/g) ?? []).length;
    expect(moveCommandCount).toBeGreaterThan(1);
  });

  it('tooltip: ngày quên ghi ("0 kcal" thật) phải nói "Chưa ghi bữa nào", KHÔNG PHẢI "0 kcal"', () => {
    // Test hàm thuần bên trong `content` của Tooltip — mô phỏng chuột hover
    // qua Recharts trong jsdom không đáng tin cậy (không có toạ độ layout
    // thật), nên kiểm trực tiếp logic quyết định câu chữ (PLAN §5.2 gợi ý
    // đúng cách này khi biểu đồ khó test qua render).
    const rows = buildCaloriesTooltipRows({
      date: '2026-08-02',
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
      weekAvgCalories: 1750,
      weekAvgCaloriesRaw: 1750,
    });
    const dailyRow = rows.find((r) => r.label === 'Calo hôm đó');
    expect(dailyRow?.value).toBe('Chưa ghi bữa nào');
    expect(dailyRow?.value).not.toMatch(/0 ?kcal/);
  });

  it('tooltip: tuần cắt cụt nhưng CÓ ăn thật không được báo "Không ghi bữa nào" (dùng weekAvgCaloriesRaw, không dùng weekAvgCalories)', () => {
    const rows = buildCaloriesTooltipRows({
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
      totalCalories: 500,
      mealCount: 2,
      weekAvgCalories: null, // bị loại khỏi ĐƯỜNG VẼ vì cắt cụt (§4.4)
      weekAvgCaloriesRaw: 2200, // nhưng SỰ THẬT là có ăn
    });
    const weeklyRow = rows.find((r) => r.label === 'Trung bình tuần');
    expect(weeklyRow?.value).toBe('2.200 kcal');
  });
});

describe('CaloriesChart — trục Y bắt đầu từ 0 (SPEC §5.1, ngược lại cân nặng/vòng bụng)', () => {
  it('nhãn trục Y có "0" ở đáy khi mọi giá trị đều dương', () => {
    const days = [
      day({ date: '2026-08-01', totalCalories: 1800, mealCount: 3 }),
      day({ date: '2026-08-02', totalCalories: 2000, mealCount: 2 }),
    ];
    const { container } = render(
      <CaloriesChart days={days} weeks={[]} from="2026-08-01" to="2026-08-02" dailyCalorieTarget={null} testDimensions={DIMS} />,
    );
    const yLabels = Array.from(
      container.querySelectorAll('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value'),
    ).map((el) => el.textContent);
    expect(yLabels).toContain('0');
  });
});

describe('CaloriesChart — ReferenceLine mục tiêu calo (SPEC §3.4)', () => {
  it('dailyCalorieTarget cao hơn hẳn dữ liệu vẫn phải hiện (ifOverflow="extendDomain", không bị "discard" âm thầm)', () => {
    const days = [
      day({ date: '2026-08-01', totalCalories: 1200, mealCount: 3 }),
      day({ date: '2026-08-02', totalCalories: 1300, mealCount: 2 }),
    ];
    const { container } = render(
      <CaloriesChart days={days} weeks={[]} from="2026-08-01" to="2026-08-02" dailyCalorieTarget={2500} testDimensions={DIMS} />,
    );
    expect(container.querySelector('.recharts-reference-line')).toBeTruthy();
  });

  it('dailyCalorieTarget === null → không có ReferenceLine, không vỡ', () => {
    const days = [
      day({ date: '2026-08-01', totalCalories: 1200, mealCount: 3 }),
      day({ date: '2026-08-02', totalCalories: 1300, mealCount: 2 }),
    ];
    const { container } = render(
      <CaloriesChart days={days} weeks={[]} from="2026-08-01" to="2026-08-02" dailyCalorieTarget={null} testDimensions={DIMS} />,
    );
    expect(container.querySelector('.recharts-reference-line')).toBeNull();
  });
});
