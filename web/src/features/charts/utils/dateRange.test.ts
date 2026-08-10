import { describe, expect, it } from 'vitest';
import { rangeToDates } from './dateRange';

const TODAY = '2026-08-06';

describe('rangeToDates', () => {
  it('30d: from là 29 ngày trước hôm nay, to là hôm nay (đúng 30 phần tử)', () => {
    expect(rangeToDates('30d', TODAY)).toEqual({ from: '2026-07-08', to: '2026-08-06' });
  });

  it('90d: from là 89 ngày trước hôm nay', () => {
    expect(rangeToDates('90d', TODAY)).toEqual({ from: '2026-05-09', to: '2026-08-06' });
  });

  it('365d: from là 364 ngày trước hôm nay', () => {
    expect(rangeToDates('365d', TODAY)).toEqual({ from: '2025-08-07', to: '2026-08-06' });
  });

  it('from luôn <= to (không bao giờ sinh khoảng ngược, không cần backend trả 400)', () => {
    for (const option of ['30d', '90d', '365d'] as const) {
      const { from, to } = rangeToDates(option, TODAY);
      expect(from <= to).toBe(true);
    }
  });

  it('to không bao giờ ở tương lai — luôn đúng bằng "hôm nay" được truyền vào', () => {
    const { to } = rangeToDates('90d', TODAY);
    expect(to).toBe(TODAY);
  });
});
