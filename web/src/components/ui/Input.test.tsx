import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './Input';

// Deliverable Bước 5 #4 (buoc-5-brief.md) — Input + FieldError:
// <input> có aria-invalid="true" và thông báo nằm NGAY DƯỚI ô, liên kết
// bằng aria-describedby.

describe('Input — không có lỗi', () => {
  it('không gắn aria-invalid, không render thông báo lỗi', () => {
    render(<Input id="weight" label="Cân nặng" />);
    const input = screen.getByLabelText('Cân nặng');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });
});

describe('Input — có lỗi (error prop)', () => {
  it('gắn aria-invalid="true" và aria-describedby trỏ đúng vào FieldError render ngay dưới ô', () => {
    render(<Input id="weight" label="Cân nặng" error="Cân nặng phải lớn hơn 0" />);

    const input = screen.getByLabelText('Cân nặng');
    expect(input.getAttribute('aria-invalid')).toBe('true');

    const describedById = input.getAttribute('aria-describedby');
    expect(describedById).toBe('weight-error');

    // Thông báo thật sự tồn tại, đúng id mà aria-describedby trỏ tới, và
    // đúng nội dung message truyền vào.
    const errorNode = document.getElementById(describedById!);
    expect(errorNode).not.toBeNull();
    expect(errorNode!.textContent).toBe('Cân nặng phải lớn hơn 0');
  });

  it('label vẫn gắn đúng htmlFor/id — bấm vào nhãn focus đúng ô nhập', () => {
    render(<Input id="waist" label="Vòng bụng" error="Bắt buộc" />);
    const input = screen.getByLabelText('Vòng bụng');
    expect(input.id).toBe('waist');
  });
});
