import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFieldErrors } from './useFieldErrors';
import { ApiError } from '../types/api';

// Deliverable #5 của buoc-6-brief.md: nhiều lỗi cùng lúc ra đủ nhiều entry;
// `path: "date"` khi form không có ô `date` rơi vào nhóm lỗi cấp form,
// không bị nuốt; reset() xoá sạch.

describe('useFieldErrors', () => {
  it('nhiều lỗi cùng lúc ra đủ nhiều entry, đúng path → message', () => {
    const { result } = renderHook(() => useFieldErrors(['weightKg', 'waistCm']));

    act(() => {
      result.current.setError(
        new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', [
          { path: 'weightKg', message: 'phải > 0' },
          { path: 'waistCm', message: 'phải là số nguyên' },
        ]),
      );
    });

    expect(result.current.fieldErrors).toEqual({
      weightKg: 'phải > 0',
      waistCm: 'phải là số nguyên',
    });
    expect(result.current.formErrors).toEqual([]);
    expect(result.current.errorCount).toBe(2);
    expect(result.current.firstErrorPath).toBe('weightKg');
    expect(result.current.summary).toBe('Có 2 lỗi cần sửa.');
  });

  it('path "date" không thuộc form (không khai trong knownFields) rơi vào nhóm lỗi cấp form, không bị nuốt', () => {
    // Form sửa một bữa ăn theo id không có ô ngày, nhưng server validate
    // `date` trong body (SPEC §7.3, web-today/SPEC.md §5.2).
    const { result } = renderHook(() => useFieldErrors(['name', 'calories']));

    act(() => {
      result.current.setError(
        new ApiError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', [
          { path: 'calories', message: 'phải là số nguyên dương' },
          { path: 'date', message: 'không được là ngày tương lai' },
        ]),
      );
    });

    expect(result.current.fieldErrors).toEqual({ calories: 'phải là số nguyên dương' });
    expect(result.current.formErrors).toEqual([{ path: 'date', message: 'không được là ngày tương lai' }]);
    // Tổng vẫn đếm đủ cả hai — "date" không biến mất, chỉ đổi nhóm.
    expect(result.current.errorCount).toBe(2);
  });

  it('reset() xoá sạch mọi lỗi', () => {
    const { result } = renderHook(() => useFieldErrors(['weightKg']));

    act(() => {
      result.current.setError(
        new ApiError(400, 'VALIDATION_ERROR', 'lỗi', [{ path: 'weightKg', message: 'phải > 0' }]),
      );
    });
    expect(result.current.errorCount).toBe(1);

    act(() => {
      result.current.reset();
    });

    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.formErrors).toEqual([]);
    expect(result.current.errorCount).toBe(0);
    expect(result.current.firstErrorPath).toBeNull();
    expect(result.current.summary).toBeNull();
  });

  it('setError(null) — vd. lỗi mạng/500 không có fields[] — dọn về không có lỗi field nào', () => {
    const { result } = renderHook(() => useFieldErrors(['weightKg']));

    act(() => {
      result.current.setError(
        new ApiError(400, 'VALIDATION_ERROR', 'lỗi', [{ path: 'weightKg', message: 'phải > 0' }]),
      );
    });
    expect(result.current.errorCount).toBe(1);

    act(() => {
      // ApiError không có fields[] (vd. 500 INTERNAL_ERROR) — không phải lỗi
      // validate, hook không có gì để map.
      result.current.setError(new ApiError(500, 'INTERNAL_ERROR', 'lỗi máy chủ'));
    });

    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.formErrors).toEqual([]);
    expect(result.current.errorCount).toBe(0);
  });

  it('không truyền knownFields (mặc định rỗng) → mọi path đều rơi vào nhóm lỗi cấp form', () => {
    const { result } = renderHook(() => useFieldErrors());

    act(() => {
      result.current.setError(
        new ApiError(400, 'VALIDATION_ERROR', 'lỗi', [{ path: 'anything', message: 'sai' }]),
      );
    });

    expect(result.current.fieldErrors).toEqual({});
    expect(result.current.formErrors).toEqual([{ path: 'anything', message: 'sai' }]);
    expect(result.current.errorCount).toBe(1);
  });
});
