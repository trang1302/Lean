import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import { Input } from './Input';
import { NumberInput } from './NumberInput';
import { Select } from './Select';
import { Switch } from './Switch';

// Deliverable Bước 5 #5 — "tab được hết qua mọi control bằng bàn phím"
// (khoản nợ a11y số 6 của web-today/PLAN.md §6, giải ở đây MỘT LẦN cho cả
// ba trang thay vì mỗi trang tự kiểm). Dựng một form mẫu gồm đủ 5 control
// và xác nhận Tab đi qua đúng thứ tự DOM, không nhảy cóc/kẹt ở đâu.

function SampleForm() {
  return (
    <form>
      <Input id="name" label="Tên món" />
      <NumberInput id="calories" label="Calo" />
      <Select id="slot" label="Buổi">
        <option value="breakfast">Sáng</option>
        <option value="lunch">Trưa</option>
      </Select>
      <Switch id="reminder" label="Nhắc nhở" />
      <Button>Lưu</Button>
    </form>
  );
}

describe('Tab qua đủ 5 control: Input, NumberInput, Select, Switch, Button', () => {
  it('mỗi lần Tab focus đúng control tiếp theo, không bị kẹt/nhảy cóc', async () => {
    const user = userEvent.setup();
    render(<SampleForm />);

    const nameInput = screen.getByLabelText('Tên món');
    const caloriesInput = screen.getByLabelText('Calo');
    const slotSelect = screen.getByLabelText('Buổi');
    const reminderSwitch = screen.getByLabelText('Nhắc nhở');
    const saveButton = screen.getByRole('button', { name: 'Lưu' });

    // document.body là điểm bắt đầu (chưa focus gì) — Tab đầu tiên phải vào
    // control đầu tiên theo thứ tự DOM.
    await user.tab();
    expect(document.activeElement).toBe(nameInput);

    await user.tab();
    expect(document.activeElement).toBe(caloriesInput);

    await user.tab();
    expect(document.activeElement).toBe(slotSelect);

    await user.tab();
    expect(document.activeElement).toBe(reminderSwitch);

    await user.tab();
    expect(document.activeElement).toBe(saveButton);
  });

  it('Shift+Tab đi ngược lại đúng thứ tự', async () => {
    const user = userEvent.setup();
    render(<SampleForm />);

    const nameInput = screen.getByLabelText('Tên món');
    const caloriesInput = screen.getByLabelText('Calo');
    const saveButton = screen.getByRole('button', { name: 'Lưu' });

    saveButton.focus();
    expect(document.activeElement).toBe(saveButton);

    // Lùi qua Switch rồi Select trước khi tới lại NumberInput.
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(caloriesInput);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(nameInput);
  });
});
