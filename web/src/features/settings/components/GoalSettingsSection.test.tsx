import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../lib/apiClient';
import { GoalSettingsSection } from './GoalSettingsSection';
import type { Goal } from '../../../types/api';

// Component này ánh xạ 9 ô nhập sang 9 khóa của `GoalPatch`. Server KHÔNG
// `.strict()` nên một ánh xạ sai bị strip IM LẶNG — không 400, không lỗi, chỉ
// là giá trị biến mất. Test dưới đây là chốt chặn duy nhất cho việc đó.
//
// Mock ở tầng `apiClient`, KHÔNG ở tầng `settings.api` — cùng quán lệ với
// `SettingsPage.test.tsx`. Mock ở `apiClient` còn phủ được cả `updateGoal`,
// nơi có danh sách trắng cứng dễ bỏ sót khóa.

const EMPTY_GOAL: Goal = {
  startWeightKg: null,
  startDate: null,
  targetWeightKg: null,
  targetWaistCm: null,
  targetChestCm: null,
  targetShoulderCm: null,
  targetArmCm: null,
  targetDate: null,
  dailyCalorieTarget: null,
  updatedAt: null,
};

afterEach(() => {
  vi.restoreAllMocks();
});

/** `ma7` = giá trị `goal.currentMa7WeightKg` mà `/summary` trả về. */
function mockLoads(goal: Goal = EMPTY_GOAL, ma7: number | null = null) {
  vi.spyOn(apiClient, 'get').mockImplementation((path: string) => {
    if (path === '/goal') return Promise.resolve(goal);
    if (path.startsWith('/summary')) {
      return Promise.resolve({ days: [], weeks: [], goal: { currentMa7WeightKg: ma7 } });
    }
    return Promise.reject(new Error(`unexpected path in test: ${path}`));
  });
  return vi.spyOn(apiClient, 'put').mockResolvedValue(goal);
}

describe('GoalSettingsSection — 9 ô ánh xạ sang đúng 9 khóa', () => {
  it('render đủ 9 ô, chia hai nhóm có tiêu đề', async () => {
    mockLoads();
    render(<GoalSettingsSection />);

    await screen.findByText('Điểm xuất phát');
    expect(screen.getByText('Đích đến')).toBeTruthy();

    for (const label of [
      'Cân nặng lúc bắt đầu (kg)',
      'Ngày bắt đầu',
      'Cân nặng đích (kg)',
      'Vòng bụng đích (cm)',
      'Vòng ngực đích (cm)',
      'Vòng vai đích (cm)',
      'Vòng bắp tay đích (cm)',
      'Ngày đích',
      'Calo mục tiêu / ngày',
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it('bấm Lưu gửi đúng 9 khóa với đúng giá trị từng ô', async () => {
    const put = mockLoads();
    const user = userEvent.setup();
    render(<GoalSettingsSection />);

    await screen.findByLabelText('Cân nặng đích (kg)');

    await user.type(screen.getByLabelText('Cân nặng lúc bắt đầu (kg)'), '75');
    await user.type(screen.getByLabelText('Ngày bắt đầu'), '2026-08-01');
    await user.type(screen.getByLabelText('Cân nặng đích (kg)'), '68');
    await user.type(screen.getByLabelText('Vòng bụng đích (cm)'), '80');
    await user.type(screen.getByLabelText('Vòng ngực đích (cm)'), '95');
    await user.type(screen.getByLabelText('Vòng vai đích (cm)'), '110');
    await user.type(screen.getByLabelText('Vòng bắp tay đích (cm)'), '30');
    await user.type(screen.getByLabelText('Ngày đích'), '2027-01-01');
    await user.type(screen.getByLabelText('Calo mục tiêu / ngày'), '1800');

    await user.click(screen.getByRole('button', { name: /Lưu mục tiêu/ }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    // Khẳng định trên BODY thật gửi đi, không phải trên tham số của `updateGoal`
    // — đó là cách duy nhất bắt được danh sách trắng cứng bỏ sót khóa.
    expect(put).toHaveBeenCalledWith('/goal', {
      startWeightKg: 75,
      startDate: '2026-08-01',
      targetWeightKg: 68,
      targetWaistCm: 80,
      targetChestCm: 95,
      targetShoulderCm: 110,
      targetArmCm: 30,
      targetDate: '2027-01-01',
      dailyCalorieTarget: 1800,
    });
  });

  it('ô để trống gửi null, không gửi chuỗi rỗng', async () => {
    const put = mockLoads();
    const user = userEvent.setup();
    render(<GoalSettingsSection />);

    await screen.findByLabelText('Cân nặng đích (kg)');
    await user.click(screen.getByRole('button', { name: /Lưu mục tiêu/ }));

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    const body = put.mock.calls[0]![1] as Record<string, unknown>;
    expect(Object.keys(body)).toHaveLength(9);
    for (const value of Object.values(body)) {
      expect(value).toBeNull();
    }
  });
});

describe('GoalSettingsSection — tự điền "cân đầu" (spec §5.4)', () => {
  it('startWeightKg chưa đặt → ô điền sẵn MA7 hôm nay', async () => {
    mockLoads(EMPTY_GOAL, 72.4);
    render(<GoalSettingsSection />);

    await waitFor(() =>
      expect(
        (screen.getByLabelText('Cân nặng lúc bắt đầu (kg)') as HTMLInputElement).value,
      ).toBe('72.4'),
    );
  });

  // LƯU Ý (review Task 7, finding Important #2): tên test này KHÔNG có nghĩa
  // là đang kiểm riêng điều kiện (c) "`goal.startWeightKg !== null` → không
  // điền". Trong component, cổng chặn THẬT SỰ trên mọi đường tới được qua
  // API công khai là `setInputs(prev => prev.startWeightKg === '' ? ... :
  // prev)` bên trong effect — vì hiệu ứng đồng bộ (`useEffect` đồng bộ
  // `goal`) luôn set `inputs.startWeightKg` thành chuỗi khác `''` TRƯỚC KHI
  // effect điền sẵn kịp chạy tới nhánh này. Xoá điều kiện (c) sẽ KHÔNG làm
  // test này đỏ — đã kiểm bằng cách trace thủ công thứ tự effect. Điều kiện
  // (c) vẫn giữ lại trong component vì nó là phòng thủ LỚP HAI, có giá trị
  // thật nếu một refactor tương lai đổi thứ tự hai effect hoặc cách khởi tạo
  // `inputs`; test này chỉ xác nhận HÀNH VI CUỐI CÙNG (giá trị hiển thị),
  // không cô lập được cơ chế nào tạo ra hành vi đó.
  it('startWeightKg ĐÃ đặt → giá trị hiển thị vẫn là giá trị đã lưu, không bị MA7 thay thế', async () => {
    mockLoads({ ...EMPTY_GOAL, startWeightKg: 80 }, 72.4);
    render(<GoalSettingsSection />);

    await waitFor(() =>
      expect(
        (screen.getByLabelText('Cân nặng lúc bắt đầu (kg)') as HTMLInputElement).value,
      ).toBe('80'),
    );
  });

  it('chưa đủ dữ liệu để có MA7 → ô để trống, không bịa số', async () => {
    mockLoads(EMPTY_GOAL, null);
    render(<GoalSettingsSection />);

    await screen.findByLabelText('Cân nặng lúc bắt đầu (kg)');
    expect(
      (screen.getByLabelText('Cân nặng lúc bắt đầu (kg)') as HTMLInputElement).value,
    ).toBe('');
  });

  it('giá trị điền sẵn là BẢN NHÁP — không tự lưu khi chưa bấm Lưu', async () => {
    const put = mockLoads(EMPTY_GOAL, 72.4);
    render(<GoalSettingsSection />);

    await waitFor(() =>
      expect(
        (screen.getByLabelText('Cân nặng lúc bắt đầu (kg)') as HTMLInputElement).value,
      ).toBe('72.4'),
    );
    expect(put).not.toHaveBeenCalled();
  });
});
