import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReminderCard } from './ReminderCard';
import type { ReminderView } from '../api/settings.types';

// Điều BẮT BUỘC #2 của brief điều phối viên (B2) / SPEC §6: cảnh báo
// "enabled: true mà ntfyTopic rỗng" phải hiện NGAY khi gạt công tắc, tại chỗ
// trong đúng thẻ, KHÔNG chặn nút Lưu, KHÔNG tự tắt `enabled`.

const BASE_REMINDER: ReminderView = {
  kind: 'weigh_in',
  timeOfDay: '07:00',
  enabled: false,
  ntfyTopic: null,
};

function renderCard(overrides: Partial<ReminderView> = {}, onSave = vi.fn().mockResolvedValue(BASE_REMINDER)) {
  const reminder = { ...BASE_REMINDER, ...overrides };
  render(
    <ReminderCard
      reminder={reminder}
      label="Nhắc cân nặng"
      isSaving={false}
      saveError={undefined}
      onSave={onSave}
    />,
  );
  return { onSave };
}

describe('ReminderCard — cảnh báo thiếu topic khi enabled (SPEC §6)', () => {
  it('KHÔNG hiện cảnh báo khi enabled=false, dù topic rỗng', () => {
    renderCard({ enabled: false, ntfyTopic: null });
    expect(screen.queryByText(/sẽ không có thông báo nào được gửi/i)).toBeNull();
  });

  it('KHÔNG hiện cảnh báo khi enabled=true và đã có topic hợp lệ', () => {
    renderCard({ enabled: true, ntfyTopic: 'lean-abc123' });
    expect(screen.queryByText(/sẽ không có thông báo nào được gửi/i)).toBeNull();
  });

  it('gạt công tắc sang bật khi topic đang trống → cảnh báo hiện NGAY LẬP TỨC, trước khi bấm Lưu', async () => {
    const user = userEvent.setup();
    renderCard({ enabled: false, ntfyTopic: null });

    expect(screen.queryByText(/sẽ không có thông báo nào được gửi/i)).toBeNull();

    const switchInput = screen.getByRole('switch', { name: 'Bật nhắc nhở' });
    await user.click(switchInput);

    expect(screen.getByText(/sẽ không có thông báo nào được gửi/i)).toBeTruthy();
    // Chưa bấm Lưu — chứng minh cảnh báo không phụ thuộc vào việc gửi request.
  });

  it('điền topic hợp lệ vào ô đang cảnh báo → cảnh báo biến mất', async () => {
    const user = userEvent.setup();
    renderCard({ enabled: true, ntfyTopic: null });

    expect(screen.getByText(/sẽ không có thông báo nào được gửi/i)).toBeTruthy();

    const topicField = screen.getByLabelText('ntfy topic');
    await user.type(topicField, 'lean-abc123');

    expect(screen.queryByText(/sẽ không có thông báo nào được gửi/i)).toBeNull();
  });

  it('nút Lưu KHÔNG bị chặn khi đang cảnh báo, và bấm Lưu KHÔNG tự tắt enabled', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ...BASE_REMINDER, enabled: true, ntfyTopic: null });
    renderCard({ enabled: true, ntfyTopic: null }, onSave);

    const saveButton = screen.getByRole('button', { name: 'Lưu' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);

    await user.click(saveButton);

    expect(onSave).toHaveBeenCalledWith({ timeOfDay: '07:00', enabled: true, ntfyTopic: null });
    // Công tắc vẫn bật sau khi lưu — component không tự tắt `enabled`.
    const switchInput = screen.getByRole('switch', { name: 'Bật nhắc nhở' }) as HTMLInputElement;
    expect(switchInput.checked).toBe(true);
  });
});

describe('ReminderCard — ô trống gửi null, không phải rỗng (điều BẮT BUỘC #4)', () => {
  it('xóa trắng ô topic rồi Lưu → onSave nhận ntfyTopic: null, không phải ""', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ ...BASE_REMINDER, enabled: false, ntfyTopic: null });
    renderCard({ enabled: false, ntfyTopic: 'lean-old-topic' }, onSave);

    const topicField = screen.getByLabelText('ntfy topic') as HTMLInputElement;
    await user.clear(topicField);
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ ntfyTopic: null }),
    );
  });
});

describe('ReminderCard — nút "Gửi thử" bị chặn, không render (điều phối viên B3)', () => {
  it('không có nút nào tên "Gửi thử" trên thẻ, dù enabled hay disabled', () => {
    renderCard({ enabled: true, ntfyTopic: 'lean-abc123' });
    expect(screen.queryByRole('button', { name: /gửi thử/i })).toBeNull();
  });
});
