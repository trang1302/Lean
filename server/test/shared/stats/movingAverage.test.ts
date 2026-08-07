import { describe, it, expect } from 'vitest';
import { movingAverage7 } from '../../../src/shared/stats/movingAverage.js';

/**
 * Định nghĩa lấy từ §6 của 2026-08-06-health-tracker-design.md:
 * MA7 tại ngày d = trung bình các giá trị CÓ THẬT trong cửa sổ 7 NGÀY LỊCH [d-6, d].
 * Ngày trống bị bỏ qua, không nội suy. Dưới 2 giá trị trong cửa sổ → null.
 */
describe('movingAverage7', () => {
  it('trả về đúng một điểm cho mỗi ngày trong [from, to]', () => {
    const out = movingAverage7([], '2026-08-01', '2026-08-05');
    expect(out.map((p) => p.date)).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
    ]);
  });

  it('cửa sổ đủ giá trị thì trả trung bình cộng', () => {
    const points = [
      { date: '2026-08-01', value: 70 },
      { date: '2026-08-02', value: 72 },
      { date: '2026-08-03', value: 74 },
    ];
    const out = movingAverage7(points, '2026-08-03', '2026-08-03');
    expect(out[0]?.ma7).toBeCloseTo(72, 10);
  });

  it('cửa sổ chỉ có 1 giá trị thì trả null — một điểm đơn lẻ không phải trung bình', () => {
    const points = [{ date: '2026-08-03', value: 70 }];
    const out = movingAverage7(points, '2026-08-03', '2026-08-03');
    expect(out[0]?.ma7).toBeNull();
  });

  it('cửa sổ rỗng thì trả null', () => {
    const out = movingAverage7([{ date: '2026-01-01', value: 70 }], '2026-08-03', '2026-08-03');
    expect(out[0]?.ma7).toBeNull();
  });

  it('đúng 2 giá trị là ngưỡng tối thiểu — có kết quả, không phải null', () => {
    const points = [
      { date: '2026-08-02', value: 70 },
      { date: '2026-08-03', value: 80 },
    ];
    const out = movingAverage7(points, '2026-08-03', '2026-08-03');
    expect(out[0]?.ma7).toBeCloseTo(75, 10);
  });

  it('cửa sổ là 7 NGÀY LỊCH, không phải 7 điểm dữ liệu gần nhất', () => {
    // Hai điểm cách nhau 10 ngày. Tại 2026-08-15 cửa sổ là [2026-08-09, 2026-08-15]
    // nên điểm ngày 2026-08-05 nằm ngoài — chỉ còn 1 giá trị → null.
    const points = [
      { date: '2026-08-05', value: 70 },
      { date: '2026-08-15', value: 80 },
    ];
    const out = movingAverage7(points, '2026-08-15', '2026-08-15');
    expect(out[0]?.ma7).toBeNull();
  });

  it('ngày thứ 7 tính từ d vẫn nằm trong cửa sổ, ngày thứ 8 thì không', () => {
    const inWindow = movingAverage7(
      [
        { date: '2026-08-01', value: 60 }, // d-6, còn trong cửa sổ
        { date: '2026-08-07', value: 80 },
      ],
      '2026-08-07',
      '2026-08-07',
    );
    expect(inWindow[0]?.ma7).toBeCloseTo(70, 10);

    const outOfWindow = movingAverage7(
      [
        { date: '2026-07-31', value: 60 }, // d-7, đã ra ngoài
        { date: '2026-08-07', value: 80 },
      ],
      '2026-08-07',
      '2026-08-07',
    );
    expect(outOfWindow[0]?.ma7).toBeNull();
  });

  it('điểm nằm trước `from` vẫn được tính nếu lọt vào cửa sổ', () => {
    // Cửa sổ của ngày đầu khoảng truy vấn lùi về trước `from` — dữ liệu
    // trước đó không được bỏ qua, nếu không ngày đầu luôn thiếu dữ liệu oan.
    const points = [
      { date: '2026-08-01', value: 70 },
      { date: '2026-08-02', value: 74 },
    ];
    const out = movingAverage7(points, '2026-08-02', '2026-08-02');
    expect(out[0]?.ma7).toBeCloseTo(72, 10);
  });

  it('ngày trống bị bỏ qua chứ không tính là 0', () => {
    const points = [
      { date: '2026-08-01', value: 70 },
      // 08-02, 08-03 không ghi
      { date: '2026-08-04', value: 74 },
    ];
    const out = movingAverage7(points, '2026-08-04', '2026-08-04');
    expect(out[0]?.ma7).toBeCloseTo(72, 10);
  });

  it('không phụ thuộc thứ tự đầu vào', () => {
    const points = [
      { date: '2026-08-03', value: 74 },
      { date: '2026-08-01', value: 70 },
      { date: '2026-08-02', value: 72 },
    ];
    const out = movingAverage7(points, '2026-08-03', '2026-08-03');
    expect(out[0]?.ma7).toBeCloseTo(72, 10);
  });

  it('không làm thay đổi mảng đầu vào', () => {
    const points = [
      { date: '2026-08-03', value: 74 },
      { date: '2026-08-01', value: 70 },
    ];
    const snapshot = JSON.stringify(points);
    movingAverage7(points, '2026-08-01', '2026-08-03');
    expect(JSON.stringify(points)).toBe(snapshot);
  });

  it('from > to thì trả mảng rỗng', () => {
    expect(movingAverage7([], '2026-08-05', '2026-08-01')).toEqual([]);
  });
});
