import { describe, expect, it } from 'vitest';
import { addDaysIso } from './dateMath';

describe('addDaysIso', () => {
  it('cộng ngày trong cùng một tháng', () => {
    expect(addDaysIso('2026-08-06', 1)).toBe('2026-08-07');
  });

  it('trừ ngày (số âm) qua biên tháng', () => {
    expect(addDaysIso('2026-08-01', -1)).toBe('2026-07-31');
  });

  it('cộng ngày qua biên năm', () => {
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('cộng ngày qua ngày nhuận (2028 là năm nhuận)', () => {
    expect(addDaysIso('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysIso('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('cộng 0 ngày trả về đúng ngày ban đầu', () => {
    expect(addDaysIso('2026-08-06', 0)).toBe('2026-08-06');
  });

  it('cộng nhiều ngày (365) qua năm không nhuận', () => {
    expect(addDaysIso('2026-08-06', 365)).toBe('2027-08-06');
  });
});
