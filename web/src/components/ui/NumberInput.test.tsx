import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberInput } from './NumberInput';

describe('NumberInput', () => {
  it('render type="number", khác Input (type="text")', () => {
    render(<NumberInput id="calories" label="Calo" />);
    expect(screen.getByLabelText('Calo').getAttribute('type')).toBe('number');
  });

  it('gõ số gọi onChange với chuỗi thô của <input>, không tự parse/format', async () => {
    const user = userEvent.setup();
    // `defaultValue` (uncontrolled) — mục đích của test là xem GIÁ TRỊ THÔ
    // đi qua component nguyên vẹn, không phải dựng lại một component có
    // state để làm controlled input (đó là việc của TRANG gọi component
    // này, ngoài phạm vi Bước 5).
    const onChange = vi.fn();
    render(<NumberInput id="calories" label="Calo" defaultValue="" onChange={onChange} />);

    const input = screen.getByLabelText('Calo') as HTMLInputElement;
    await user.type(input, '5');

    // Giá trị cuối cùng trên chính <input> là chuỗi "5" thô — không phải
    // một số đã parse, không phải chuỗi đã format kiểu vi-VN (formatNumber
    // sẽ cho "5" y hệt ở đây vì không có phần nghìn, nhưng thử với việc
    // KHÔNG dùng formatNumber là điều quan trọng, không phải giá trị cụ thể).
    expect(input.value).toBe('5');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]?.[0]?.target.value).toBe('5');
  });

  it('có lỗi: gắn aria-invalid và FieldError giống Input', () => {
    render(<NumberInput id="calories" label="Calo" error="Phải lớn hơn 0" />);
    const input = screen.getByLabelText('Calo');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('calories-error');
  });
});
