import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiClient } from '../../../lib/apiClient';
import { ApiError } from '../../../types/api';
import { SettingsPage } from './SettingsPage';
import type { ReminderView } from '../api/settings.types';

const EMPTY_GOAL = {
  targetWeightKg: null,
  targetDate: null,
  dailyCalorieTarget: null,
  updatedAt: null,
};

const DEFAULT_REMINDERS: ReminderView[] = [
  { kind: 'weigh_in', timeOfDay: '07:00', enabled: false, ntfyTopic: null },
  { kind: 'meal_log', timeOfDay: '20:00', enabled: false, ntfyTopic: null },
];

afterEach(() => {
  vi.restoreAllMocks();
});

function mockLoads(goal: unknown = EMPTY_GOAL, reminders: unknown = DEFAULT_REMINDERS) {
  vi.spyOn(apiClient, 'get').mockImplementation((path: string) => {
    if (path === '/goal') return Promise.resolve(goal);
    if (path === '/reminders') return Promise.resolve(reminders);
    return Promise.reject(new Error(`unexpected path in test: ${path}`));
  });
}

describe('SettingsPage — trang trắng (chưa từng đặt gì), không có lỗi 404 nào (SPEC §3)', () => {
  it('render 3 ô Mục tiêu trống và 2 thẻ Nhắc nhở mặc định', async () => {
    mockLoads();
    render(<SettingsPage />);

    await waitFor(() => expect(screen.getByLabelText('Cân nặng đích (kg)')).toBeTruthy());

    expect((screen.getByLabelText('Cân nặng đích (kg)') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Calo mục tiêu / ngày') as HTMLInputElement).value).toBe('');
    expect(screen.getByText('Chưa từng đặt mục tiêu')).toBeTruthy();

    expect(screen.getByText('Nhắc cân nặng')).toBeTruthy();
    expect(screen.getByText('Nhắc ghi bữa ăn')).toBeTruthy();
  });

  it('cảnh báo scheduler BẮT BUỘC luôn hiện ngay khi trang render xong dữ liệu, không cần tương tác (SPEC §5)', async () => {
    mockLoads();
    render(<SettingsPage />);

    await waitFor(() =>
      expect(screen.getByText(/nhắc nhở chỉ hoạt động khi server đang chạy/i)).toBeTruthy(),
    );
  });

  it('trang KHÔNG gọi GET /api/summary (SPEC §2 — tiến độ mục tiêu là việc của trang Biểu đồ)', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockImplementation((path: string) => {
      if (path === '/goal') return Promise.resolve(EMPTY_GOAL);
      if (path === '/reminders') return Promise.resolve(DEFAULT_REMINDERS);
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });
    render(<SettingsPage />);

    await waitFor(() => expect(screen.getByLabelText('Cân nặng đích (kg)')).toBeTruthy());

    expect(getSpy.mock.calls.map((c) => c[0])).not.toContain('/summary');
  });
});

describe('SettingsPage — mục tiêu đã có dữ liệu', () => {
  it('hiện đúng giá trị đã lưu và updatedAt định dạng theo giờ VN, không phải chuỗi ISO thô', async () => {
    mockLoads({
      targetWeightKg: 68,
      targetDate: '2026-12-31',
      dailyCalorieTarget: 1900,
      updatedAt: '2026-08-07T10:22:31.000Z',
    });
    render(<SettingsPage />);

    await waitFor(() =>
      expect((screen.getByLabelText('Cân nặng đích (kg)') as HTMLInputElement).value).toBe('68'),
    );
    expect((screen.getByLabelText('Calo mục tiêu / ngày') as HTMLInputElement).value).toBe('1900');
    expect(screen.getByText(/Cập nhật lần cuối/)).toBeTruthy();
    expect(screen.queryByText('2026-08-07T10:22:31.000Z')).toBeNull();
  });
});

describe('SettingsPage — lỗi mạng cấp trang (Bước 7)', () => {
  it('server chưa chạy → hiện ErrorState rõ ràng cho từng khối, không phải màn hình trắng', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được server — server đã chạy chưa?'),
    );
    render(<SettingsPage />);

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/không kết nối được server/i).length).toBeGreaterThanOrEqual(1);
  });

  it('nút Thử lại gọi lại đúng hàm nạp bị hỏng', async () => {
    const user = userEvent.setup();
    const getSpy = vi
      .spyOn(apiClient, 'get')
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được server — server đã chạy chưa?'))
      .mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'Không kết nối được server — server đã chạy chưa?'))
      .mockImplementation((path: string) => {
        if (path === '/goal') return Promise.resolve(EMPTY_GOAL);
        if (path === '/reminders') return Promise.resolve(DEFAULT_REMINDERS);
        return Promise.reject(new Error('unexpected'));
      });

    render(<SettingsPage />);
    await screen.findAllByRole('alert');

    const retryButtons = screen.getAllByRole('button', { name: 'Thử lại' });
    for (const btn of retryButtons) {
      await user.click(btn);
    }

    await waitFor(() => expect(screen.getByLabelText('Cân nặng đích (kg)')).toBeTruthy());
    expect(getSpy.mock.calls.length).toBeGreaterThan(2);
  });
});
