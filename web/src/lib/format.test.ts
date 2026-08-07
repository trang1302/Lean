import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDateFull, formatDateShort, formatNullable, formatNumber, todayIso } from './format';

afterEach(() => {
  vi.useRealTimers();
});

describe('todayIso', () => {
  it('trả chuỗi đúng định dạng "YYYY-MM-DD"', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it(
    'tính theo Asia/Ho_Chi_Minh, KHÔNG theo UTC hay TZ của tiến trình — ' +
      'mốc 18:30 UTC đã sang ngày mới ở VN (UTC+7 → 01:30 hôm sau), phải ' +
      'trả ngày VN chứ không phải ngày UTC. Đây là test khóa quyết định ' +
      'phương án (b) ở docs/features/web-today/SPEC.md §7 câu 4 — không ' +
      'phải test trang trí. Bản thân test này chạy dưới TZ mặc định của ' +
      'tiến trình test; bằng chứng cho "không đổi khi đổi TZ tiến trình" ' +
      'nằm ở việc chạy CẢ FILE này dưới `TZ=UTC` và `TZ=America/New_York` ' +
      '(xem buoc-4-report.md) — một test bên trong không tự đổi được ' +
      '`process.env.TZ` lúc Node đã khởi động, nên không có test thứ hai ở đây.',
    () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-06T18:30:00.000Z'));

      expect(todayIso()).toBe('2026-08-07'); // ngày VN
      expect(todayIso()).not.toBe('2026-08-06'); // ngày UTC — sẽ sai nếu lỡ dùng toISOString()
    },
  );
});

describe('formatDateShort', () => {
  it('"2026-08-07" → "07/08"', () => {
    expect(formatDateShort('2026-08-07')).toBe('07/08');
  });

  it('không đi qua new Date() — vẫn đúng với ngày mà Date có thể cuộn tháng nếu parse sai', () => {
    expect(formatDateShort('2026-01-31')).toBe('31/01');
  });
});

describe('formatDateFull', () => {
  it('trả nguyên chuỗi "YYYY-MM-DD" — identity có chủ đích, không parse lại', () => {
    expect(formatDateFull('2026-08-07')).toBe('2026-08-07');
  });
});

describe('formatNumber', () => {
  it('định dạng số nguyên với dấu phân cách hàng nghìn', () => {
    expect(formatNumber(1234)).toBe('1.234');
  });

  it('0 vẫn hiển thị là "0", không phải chuỗi rỗng', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

describe('formatNullable', () => {
  it('null → "—", không phải "0 kg", "null kg", hay chuỗi rỗng', () => {
    expect(formatNullable(null, 'kg')).toBe('—');
  });

  it('0 là một giá trị đo thật — không bị coi như "chưa có dữ liệu"', () => {
    expect(formatNullable(0, 'kg')).toBe('0 kg');
  });

  it('số có phần thập phân giữ nguyên đơn vị truyền vào', () => {
    expect(formatNullable(62.5, 'kg')).toBe('62,5 kg');
  });
});
