import { describe, it, expect } from 'vitest';
import { weeklySummaries } from '../../../src/shared/stats/weekly.js';

/**
 * §6 spec: tuần bắt đầu THỨ HAI. `avgCalories` chỉ tính trên ngày CÓ ÍT NHẤT
 * MỘT BỮA — tính ngày quên ghi là 0 calo sẽ kéo trung bình xuống sai lệch.
 * `avgWeightKg` là trung bình số đo THÔ, không phải MA7.
 *
 * 2026-08-03 là thứ Hai; 2026-08-10 là thứ Hai kế tiếp.
 */
describe('weeklySummaries', () => {
  it('gom theo tuần bắt đầu thứ Hai', () => {
    const out = weeklySummaries([], [], '2026-08-05', '2026-08-12');
    expect(out.map((w) => w.weekStart)).toEqual(['2026-08-03', '2026-08-10']);
  });

  it('avgCalories là trung bình tổng calo mỗi ngày', () => {
    const meals = [
      { date: '2026-08-03', calories: 400 },
      { date: '2026-08-03', calories: 600 }, // ngày này 1000
      { date: '2026-08-04', calories: 2000 }, // ngày này 2000
    ];
    const out = weeklySummaries(meals, [], '2026-08-03', '2026-08-09');
    expect(out[0]?.avgCalories).toBeCloseTo(1500, 10);
  });

  it('BỎ QUA ngày không ghi bữa nào — không tính là 0 calo', () => {
    // 2 ngày có ghi (1000 và 2000), 5 ngày còn lại trong tuần bỏ trống.
    // Đúng: (1000+2000)/2 = 1500. Sai: (1000+2000)/7 ≈ 428.6
    const meals = [
      { date: '2026-08-03', calories: 1000 },
      { date: '2026-08-04', calories: 2000 },
    ];
    const out = weeklySummaries(meals, [], '2026-08-03', '2026-08-09');
    expect(out[0]?.avgCalories).toBeCloseTo(1500, 10);
    expect(out[0]?.avgCalories).not.toBeCloseTo(3000 / 7, 5);
  });

  it('tuần không có bữa nào thì avgCalories là null', () => {
    const out = weeklySummaries([], [], '2026-08-03', '2026-08-09');
    expect(out[0]?.avgCalories).toBeNull();
  });

  it('avgWeightKg là trung bình số đo THÔ trong tuần', () => {
    const weights = [
      { date: '2026-08-03', weightKg: 72 },
      { date: '2026-08-05', weightKg: 74 },
    ];
    const out = weeklySummaries([], weights, '2026-08-03', '2026-08-09');
    expect(out[0]?.avgWeightKg).toBeCloseTo(73, 10);
  });

  it('tuần không có số đo nào thì avgWeightKg là null', () => {
    const out = weeklySummaries([], [], '2026-08-03', '2026-08-09');
    expect(out[0]?.avgWeightKg).toBeNull();
  });

  it('tách đúng dữ liệu giữa hai tuần liền kề', () => {
    const meals = [
      { date: '2026-08-09', calories: 1000 }, // Chủ nhật — vẫn thuộc tuần 08-03
      { date: '2026-08-10', calories: 2000 }, // Thứ Hai — sang tuần 08-10
    ];
    const out = weeklySummaries(meals, [], '2026-08-03', '2026-08-16');
    expect(out[0]?.weekStart).toBe('2026-08-03');
    expect(out[0]?.avgCalories).toBeCloseTo(1000, 10);
    expect(out[1]?.weekStart).toBe('2026-08-10');
    expect(out[1]?.avgCalories).toBeCloseTo(2000, 10);
  });

  it('bỏ qua dữ liệu nằm ngoài [from, to]', () => {
    const meals = [{ date: '2026-07-01', calories: 9999 }];
    const out = weeklySummaries(meals, [], '2026-08-03', '2026-08-09');
    expect(out).toHaveLength(1);
    expect(out[0]?.avgCalories).toBeNull();
  });

  it('không làm thay đổi mảng đầu vào', () => {
    const meals = [{ date: '2026-08-03', calories: 1000 }];
    const weights = [{ date: '2026-08-03', weightKg: 72 }];
    const snapshot = JSON.stringify([meals, weights]);
    weeklySummaries(meals, weights, '2026-08-03', '2026-08-09');
    expect(JSON.stringify([meals, weights])).toBe(snapshot);
  });

  it('from > to thì trả mảng rỗng', () => {
    expect(weeklySummaries([], [], '2026-08-09', '2026-08-03')).toEqual([]);
  });
});
