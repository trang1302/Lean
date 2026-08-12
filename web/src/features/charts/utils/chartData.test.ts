import { describe, expect, it } from 'vitest';
import type { SummaryDay, SummaryWeek } from '../../../types/api';
import {
  buildCaloriesChartData,
  countRealPoints,
  dropTruncatedWeeks,
  hasCalorieData,
  mergeWeeklyAvg,
} from './chartData';

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
  return {
    avgCalories: null,
    avgWeightKg: null,
    ...overrides,
  };
}

describe('countRealPoints', () => {
  it('đếm đúng số ngày có giá trị thật, bỏ qua null', () => {
    const days = [
      day({ date: '2026-08-01', weightKg: 70 }),
      day({ date: '2026-08-02', weightKg: null }),
      day({ date: '2026-08-03', weightKg: 71 }),
    ];
    expect(countRealPoints(days, 'weightKg')).toBe(2);
  });

  it('trả 0 khi mọi ngày đều null — KHÔNG dùng days.length (days không bao giờ rỗng, SPEC §2.2/§6)', () => {
    const days = [
      day({ date: '2026-08-01' }),
      day({ date: '2026-08-02' }),
      day({ date: '2026-08-03' }),
    ];
    expect(countRealPoints(days, 'weightMa7')).toBe(0);
    expect(days.length).toBe(3); // đối chiếu: length không phản ánh "có dữ liệu"
  });

  it('đếm độc lập theo từng trường — waistMa7 khác weightMa7', () => {
    const days = [
      day({ date: '2026-08-01', weightMa7: 70, waistMa7: null }),
      day({ date: '2026-08-02', weightMa7: 70.5, waistMa7: 85 }),
    ];
    expect(countRealPoints(days, 'weightMa7')).toBe(2);
    expect(countRealPoints(days, 'waistMa7')).toBe(1);
  });
});

describe('hasCalorieData', () => {
  it('false khi mọi ngày mealCount === 0 (kể cả nếu totalCalories lỡ khác 0)', () => {
    const days = [day({ date: '2026-08-01' }), day({ date: '2026-08-02' })];
    expect(hasCalorieData(days)).toBe(false);
  });

  it('true khi ít nhất một ngày có mealCount > 0', () => {
    const days = [
      day({ date: '2026-08-01' }),
      day({ date: '2026-08-02', totalCalories: 500, mealCount: 2 }),
    ];
    expect(hasCalorieData(days)).toBe(true);
  });
});

describe('mergeWeeklyAvg — cạm bẫy B2.3: avgCalories === null khác hẳn 0', () => {
  it('tuần avgCalories === null (không ghi bữa nào) → mọi ngày trong tuần đó nhận weekAvgCalories: null, KHÔNG phải 0', () => {
    // Thứ Hai 2026-08-03 .. Chủ Nhật 2026-08-09
    const days = [
      day({ date: '2026-08-03' }),
      day({ date: '2026-08-04' }),
      day({ date: '2026-08-05' }),
    ];
    const weeks = [week({ weekStart: '2026-08-03', avgCalories: null })];

    const merged = mergeWeeklyAvg(days, weeks);

    for (const d of merged) {
      expect(d.weekAvgCalories).toBeNull();
      // Phòng hồi quy "sửa cho gọn" bằng `?? 0` — so sánh tường minh, không
      // chỉ `toBeFalsy()` (0 cũng falsy, sẽ không bắt được lỗi `?? 0`).
      expect(d.weekAvgCalories === 0).toBe(false);
    }
  });

  it('tuần có avgCalories thật → ghép đúng số cho mọi ngày trong tuần đó', () => {
    const days = [day({ date: '2026-08-03' }), day({ date: '2026-08-04' })];
    const weeks = [week({ weekStart: '2026-08-03', avgCalories: 1800 })];

    const merged = mergeWeeklyAvg(days, weeks);

    expect(merged[0]?.weekAvgCalories).toBe(1800);
    expect(merged[1]?.weekAvgCalories).toBe(1800);
  });

  it('ngày không khớp tuần nào (không có weekStart nào chứa nó) → null, không throw, không 0', () => {
    const days = [day({ date: '2026-08-03' })];
    const weeks: SummaryWeek[] = [];

    const merged = mergeWeeklyAvg(days, weeks);

    expect(merged[0]?.weekAvgCalories).toBeNull();
  });

  it('ngày ở biên cuối tuần (weekStart + 6) vẫn khớp đúng tuần đó', () => {
    const days = [day({ date: '2026-08-09' })]; // Chủ Nhật, weekStart + 6
    const weeks = [week({ weekStart: '2026-08-03', avgCalories: 2000 })];

    const merged = mergeWeeklyAvg(days, weeks);

    expect(merged[0]?.weekAvgCalories).toBe(2000);
  });

  it('không đụng tới các trường khác của SummaryDay — chỉ thêm weekAvgCalories', () => {
    const original = day({ date: '2026-08-03', totalCalories: 500, mealCount: 2, weightKg: 70 });
    const merged = mergeWeeklyAvg([original], []);
    expect(merged[0]).toMatchObject({
      date: '2026-08-03',
      totalCalories: 500,
      mealCount: 2,
      weightKg: 70,
    });
  });
});

describe('dropTruncatedWeeks — cạm bẫy B2.4/SPEC §4.4, phương án A', () => {
  it('giữ tuần nằm trọn trong [from, to]', () => {
    const weeks = [week({ weekStart: '2026-08-03' })]; // .. 2026-08-09
    const kept = dropTruncatedWeeks(weeks, '2026-08-01', '2026-08-15');
    expect(kept).toHaveLength(1);
  });

  it('loại tuần bị cắt cụt ở ĐẦU khoảng (weekStart nằm trước from)', () => {
    // from rơi vào thứ Năm 2026-08-06 → tuần chứa nó (weekStart 2026-08-03)
    // chỉ có 3/7 ngày (Th5,6,7) nằm trong khoảng.
    const weeks = [week({ weekStart: '2026-08-03' })];
    const kept = dropTruncatedWeeks(weeks, '2026-08-06', '2026-08-20');
    expect(kept).toHaveLength(0);
  });

  it('loại tuần bị cắt cụt ở CUỐI khoảng (weekStart + 6 vượt quá to)', () => {
    const weeks = [week({ weekStart: '2026-08-03' })]; // .. 2026-08-09
    const kept = dropTruncatedWeeks(weeks, '2026-08-01', '2026-08-07');
    expect(kept).toHaveLength(0);
  });

  it('lọc đúng một tập hỗn hợp: giữ tuần trọn, loại hai tuần cắt cụt ở hai đầu', () => {
    const weeks = [
      week({ weekStart: '2026-07-27' }), // .. 08-02, cắt cụt đầu nếu from=08-06... ở đây from=07-30 nên cắt cụt
      week({ weekStart: '2026-08-03' }), // .. 08-09, trọn
      week({ weekStart: '2026-08-10' }), // .. 08-16, cắt cụt cuối nếu to=08-14
    ];
    const kept = dropTruncatedWeeks(weeks, '2026-07-30', '2026-08-14');
    expect(kept.map((w) => w.weekStart)).toEqual(['2026-08-03']);
  });

  it('mảng weeks rỗng → trả mảng rỗng, không throw', () => {
    expect(dropTruncatedWeeks([], '2026-08-01', '2026-08-31')).toEqual([]);
  });
});

describe('kết hợp dropTruncatedWeeks + mergeWeeklyAvg (đường đi thật của CaloriesChart)', () => {
  it('ngày thuộc tuần cắt cụt bị loại trước đó → weekAvgCalories null dù tuần có avgCalories thật', () => {
    const days = [day({ date: '2026-08-06' }), day({ date: '2026-08-07' })];
    const weeks = [week({ weekStart: '2026-08-03', avgCalories: 2200 })]; // .. 08-09, cắt cụt vì from=08-06

    const fullWeeks = dropTruncatedWeeks(weeks, '2026-08-06', '2026-08-20');
    const merged = mergeWeeklyAvg(days, fullWeeks);

    for (const d of merged) {
      expect(d.weekAvgCalories).toBeNull();
    }
  });
});

describe('buildCaloriesChartData — tách "vẽ hay không" khỏi "tooltip nói gì"', () => {
  it('tuần cắt cụt CÓ ăn thật: weekAvgCalories null (không vẽ) nhưng weekAvgCaloriesRaw giữ số thật (tooltip không được nói sai "không ghi bữa nào")', () => {
    const days = [day({ date: '2026-08-06' })];
    const weeks = [week({ weekStart: '2026-08-03', avgCalories: 2200 })]; // cắt cụt vì from=08-06

    const [result] = buildCaloriesChartData(days, weeks, '2026-08-06', '2026-08-20');

    expect(result?.weekAvgCalories).toBeNull();
    expect(result?.weekAvgCaloriesRaw).toBe(2200);
  });

  it('tuần trọn vẹn và có avgCalories thật: cả hai trường khớp nhau', () => {
    const days = [day({ date: '2026-08-03' })];
    const weeks = [week({ weekStart: '2026-08-03', avgCalories: 1800 })];

    const [result] = buildCaloriesChartData(days, weeks, '2026-08-01', '2026-08-31');

    expect(result?.weekAvgCalories).toBe(1800);
    expect(result?.weekAvgCaloriesRaw).toBe(1800);
  });

  it('tuần trọn vẹn nhưng KHÔNG ghi bữa nào (avgCalories thật là null): cả hai trường đều null — đúng lúc tooltip phải nói "Không ghi bữa nào"', () => {
    const days = [day({ date: '2026-08-03' })];
    const weeks = [week({ weekStart: '2026-08-03', avgCalories: null })];

    const [result] = buildCaloriesChartData(days, weeks, '2026-08-01', '2026-08-31');

    expect(result?.weekAvgCalories).toBeNull();
    expect(result?.weekAvgCaloriesRaw).toBeNull();
  });

  it('không đụng các trường khác của SummaryDay (totalCalories/mealCount giữ nguyên)', () => {
    const days = [day({ date: '2026-08-03', totalCalories: 500, mealCount: 2 })];
    const [result] = buildCaloriesChartData(days, [], '2026-08-01', '2026-08-31');
    expect(result).toMatchObject({ date: '2026-08-03', totalCalories: 500, mealCount: 2 });
  });
});
