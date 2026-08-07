import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Component tối thiểu chỉ để chứng minh hạ tầng — chưa có component thật nào
// để test (nội dung today/charts/settings là việc của các bước sau).
function Toggle() {
  const [on, setOn] = useState(false);
  return <button onClick={() => setOn(!on)}>{on ? 'bật' : 'tắt'}</button>;
}

describe('hạ tầng render component (jsdom + Testing Library)', () => {
  it('render được và tìm thấy chữ qua screen.getByText', () => {
    render(<div>hi</div>);
    expect(screen.getByText('hi').textContent).toBe('hi');
  });

  // Bước 3 của web-today cần bấm/gõ vào form thật (BodyLogForm) — kiểm luôn
  // user-event ở đây để chắc nó hoạt động, không đợi đến lúc form thật gãy
  // mới biết hạ tầng thiếu.
  it('user-event bấm nút làm component re-render đúng state mới', async () => {
    const user = userEvent.setup();
    render(<Toggle />);
    expect(screen.getByText('tắt')).toBeTruthy();

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('bật')).toBeTruthy();
  });
});
