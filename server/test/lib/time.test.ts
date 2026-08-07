import { describe, it, expect } from 'vitest';
import {
  isValidIsoDate,
  addDays,
  daysBetween,
  enumerateDates,
  startOfWeekMonday,
  todayIso,
} from '../../src/lib/time.js';

describe('isValidIsoDate', () => {
  it('chấp nhận ngày hợp lệ', () => {
    expect(isValidIsoDate('2026-08-06')).toBe(true);
    expect(isValidIsoDate('2024-02-29')).toBe(true); // năm nhuận
  });

  it('từ chối sai định dạng', () => {
    expect(isValidIsoDate('2026-8-6')).toBe(false);
    expect(isValidIsoDate('06/08/2026')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
  });

  it('từ chối ngày không tồn tại', () => {
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('2025-02-29')).toBe(false); // không nhuận
  });
});

describe('addDays', () => {
  it('cộng và trừ ngày', () => {
    expect(addDays('2026-08-06', 1)).toBe('2026-08-07');
    expect(addDays('2026-08-06', -6)).toBe('2026-07-31');
  });

  it('vượt ranh giới tháng và năm', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('xử lý năm nhuận', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
  });
});

describe('daysBetween', () => {
  it('đếm số ngày giữa hai mốc', () => {
    expect(daysBetween('2026-08-01', '2026-08-06')).toBe(5);
    expect(daysBetween('2026-08-06', '2026-08-06')).toBe(0);
  });

  it('trả số âm khi to sớm hơn from', () => {
    expect(daysBetween('2026-08-06', '2026-08-01')).toBe(-5);
  });
});

describe('enumerateDates', () => {
  it('liệt kê đủ hai đầu mút', () => {
    expect(enumerateDates('2026-08-04', '2026-08-07')).toEqual([
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
    ]);
  });

  it('trả một phần tử khi from === to', () => {
    expect(enumerateDates('2026-08-06', '2026-08-06')).toEqual(['2026-08-06']);
  });

  it('trả mảng rỗng khi from > to', () => {
    expect(enumerateDates('2026-08-07', '2026-08-06')).toEqual([]);
  });
});

describe('startOfWeekMonday', () => {
  it('thứ Hai trả về chính nó', () => {
    // 2026-08-03 là thứ Hai
    expect(startOfWeekMonday('2026-08-03')).toBe('2026-08-03');
  });

  it('chủ Nhật lùi về thứ Hai tuần đó', () => {
    // 2026-08-09 là Chủ Nhật
    expect(startOfWeekMonday('2026-08-09')).toBe('2026-08-03');
  });

  it('giữa tuần lùi đúng', () => {
    // 2026-08-06 là thứ Năm
    expect(startOfWeekMonday('2026-08-06')).toBe('2026-08-03');
  });
});

describe('todayIso', () => {
  it('trả chuỗi đúng định dạng', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isValidIsoDate(todayIso())).toBe(true);
  });
});
