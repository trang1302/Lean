import { describe, it, expect } from 'vitest';
import {
  currentRateKgPerWeek,
  requiredRateKgPerWeek,
  isOnTrack,
  remainingKg,
} from '../../../src/shared/stats/rate.js';

/** Định nghĩa lấy từ §6 của 2026-08-06-health-tracker-design.md. */

describe('currentRateKgPerWeek', () => {
  it('lấy hiệu hai MA7 cách nhau 14 ngày rồi chia 2 để ra kg/tuần', () => {
    // giảm 0.7 kg trong 2 tuần → -0.35 kg/tuần
    expect(currentRateKgPerWeek(72.9, 73.6)).toBeCloseTo(-0.35, 10);
  });

  it('tăng cân cho ra số dương', () => {
    expect(currentRateKgPerWeek(74, 72)).toBeCloseTo(1, 10);
  });

  it('không đổi cân cho ra 0', () => {
    expect(currentRateKgPerWeek(72, 72)).toBe(0);
  });

  it('trả null nếu một trong hai MA7 là null', () => {
    expect(currentRateKgPerWeek(null, 73.6)).toBeNull();
    expect(currentRateKgPerWeek(72.9, null)).toBeNull();
    expect(currentRateKgPerWeek(null, null)).toBeNull();
  });
});

describe('requiredRateKgPerWeek', () => {
  it('chia khoảng cách còn lại cho số tuần còn lại', () => {
    // còn 4.9 kg phải giảm, còn 14 ngày = 2 tuần → -2.45 kg/tuần
    expect(requiredRateKgPerWeek(72.9, 68, '2026-08-20', '2026-08-06')).toBeCloseTo(-2.45, 10);
  });

  it('mục tiêu tăng cân cho ra số dương', () => {
    expect(requiredRateKgPerWeek(60, 62, '2026-08-20', '2026-08-06')).toBeCloseTo(1, 10);
  });

  it('trả null khi chưa đặt mục tiêu', () => {
    expect(requiredRateKgPerWeek(72.9, null, '2026-08-20', '2026-08-06')).toBeNull();
    expect(requiredRateKgPerWeek(72.9, 68, null, '2026-08-06')).toBeNull();
  });

  it('trả null khi MA7 hiện tại là null', () => {
    expect(requiredRateKgPerWeek(null, 68, '2026-08-20', '2026-08-06')).toBeNull();
  });

  it('trả null khi targetDate đã qua', () => {
    expect(requiredRateKgPerWeek(72.9, 68, '2026-08-01', '2026-08-06')).toBeNull();
  });

  it('trả null khi targetDate là hôm nay — không chia cho 0 tuần', () => {
    expect(requiredRateKgPerWeek(72.9, 68, '2026-08-06', '2026-08-06')).toBeNull();
  });
});

describe('isOnTrack', () => {
  it('mục tiêu giảm cân: đang giảm nhanh hơn mức cần thì đúng tiến độ', () => {
    expect(isOnTrack(-0.5, -0.35)).toBe(true);
  });

  it('mục tiêu giảm cân: giảm chậm hơn mức cần thì chưa đúng tiến độ', () => {
    expect(isOnTrack(-0.2, -0.35)).toBe(false);
  });

  it('mục tiêu giảm cân: đang tăng cân thì chắc chắn sai tiến độ', () => {
    expect(isOnTrack(0.3, -0.35)).toBe(false);
  });

  it('mục tiêu tăng cân: tăng nhanh hơn mức cần thì đúng tiến độ', () => {
    expect(isOnTrack(1.2, 1.0)).toBe(true);
  });

  it('mục tiêu tăng cân: tăng chậm hơn mức cần thì chưa đúng tiến độ', () => {
    expect(isOnTrack(0.5, 1.0)).toBe(false);
  });

  it('đúng bằng mức cần thì tính là đúng tiến độ', () => {
    expect(isOnTrack(-0.35, -0.35)).toBe(true);
    expect(isOnTrack(1.0, 1.0)).toBe(true);
  });

  it('trả null khi thiếu một trong hai vế', () => {
    expect(isOnTrack(null, -0.35)).toBeNull();
    expect(isOnTrack(-0.5, null)).toBeNull();
    expect(isOnTrack(null, null)).toBeNull();
  });
});

describe('remainingKg', () => {
  it('luôn là số dương — biểu thị độ lớn, không biểu thị hướng', () => {
    expect(remainingKg(72.9, 68)).toBeCloseTo(4.9, 10);
    expect(remainingKg(60, 65)).toBeCloseTo(5, 10);
  });

  it('đã đạt mục tiêu thì bằng 0', () => {
    expect(remainingKg(68, 68)).toBe(0);
  });

  it('trả null khi chưa đặt mục tiêu hoặc MA7 là null', () => {
    expect(remainingKg(72.9, null)).toBeNull();
    expect(remainingKg(null, 68)).toBeNull();
  });
});
