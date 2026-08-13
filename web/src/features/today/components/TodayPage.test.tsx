import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Link, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodayPage } from './TodayPage';
import * as todayApi from '../api/today.api';
import { todayIso } from '../../../lib/format';

vi.mock('../api/today.api', () => ({
  getBodyLog: vi.fn(),
  putBodyLog: vi.fn(),
  getMeals: vi.fn(),
  createMeal: vi.fn(),
  updateMeal: vi.fn(),
  deleteMeal: vi.fn(),
  getGoal: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

/** `TodayPage` gọi `useBlocker`, hook này chỉ chạy trong data router. Render trần
 * sẽ ném lỗi — mọi ca trong file này phải đi qua đây. */
function renderTodayPage() {
  const router = createMemoryRouter([{ path: '/', element: <TodayPage /> }], {
    initialEntries: ['/'],
  });
  return render(<RouterProvider router={router} />);
}

describe('TodayPage — ngày trắng hoàn toàn (PLAN §4 bước 7 deliverable #3)', () => {
  it('404 body-log + [] meals + goal null → không hiện "0 kg", không hiện tổng calo 0', async () => {
    vi.mocked(todayApi.getBodyLog).mockResolvedValue(null);
    vi.mocked(todayApi.getMeals).mockResolvedValue([]);
    vi.mocked(todayApi.getGoal).mockResolvedValue({
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
    });

    renderTodayPage();

    await waitFor(() => expect(todayApi.getBodyLog).toHaveBeenCalledWith(todayIso()));
    await waitFor(() => expect(screen.getByText('Chưa ghi bữa nào cho ngày này.')).toBeTruthy());

    expect((screen.getByLabelText('Cân nặng (kg)') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Vòng bụng (cm)') as HTMLInputElement).value).toBe('');
    expect(screen.queryByText(/0 kg/)).toBeNull();
    expect(screen.queryByText(/0 \/ —/)).toBeNull();
    expect(screen.queryByText(/0 calo/)).toBeNull();
    expect(screen.getByText(/Chưa ghi bữa nào — thêm bữa đầu tiên/)).toBeTruthy();
  });
});

describe('TodayPage — mount gọi ba endpoint song song đúng theo ngày hôm nay', () => {
  it('getBodyLog/getMeals dùng todayIso(), getGoal không nhận tham số', async () => {
    vi.mocked(todayApi.getBodyLog).mockResolvedValue(null);
    vi.mocked(todayApi.getMeals).mockResolvedValue([]);
    vi.mocked(todayApi.getGoal).mockResolvedValue({
      startWeightKg: null,
      startDate: null,
      targetWeightKg: null,
      targetWaistCm: null,
      targetChestCm: null,
      targetShoulderCm: null,
      targetArmCm: null,
      targetDate: null,
      dailyCalorieTarget: 1900,
      updatedAt: null,
    });

    renderTodayPage();

    await waitFor(() => expect(todayApi.getGoal).toHaveBeenCalledTimes(1));
    expect(todayApi.getBodyLog).toHaveBeenCalledWith(todayIso());
    expect(todayApi.getMeals).toHaveBeenCalledWith(todayIso());
  });
});

describe('TodayPage — có bữa ăn + mục tiêu → tổng calo và tiến độ hiện đúng', () => {
  it('render tổng calo cộng từ meals, có thanh tiến độ vì goal có dailyCalorieTarget', async () => {
    vi.mocked(todayApi.getBodyLog).mockResolvedValue({
      date: todayIso(),
      weightKg: 70,
      waistCm: 85,
      chestCm: null,
      shoulderCm: null,
      armCm: null,
      note: null,
      createdAt: '',
      updatedAt: '',
    });
    vi.mocked(todayApi.getMeals).mockResolvedValue([
      {
        id: 'm1',
        date: todayIso(),
        slot: 'breakfast',
        name: 'Phở',
        calories: 450,
        note: null,
        createdAt: '',
        updatedAt: '',
      },
    ]);
    vi.mocked(todayApi.getGoal).mockResolvedValue({
      startWeightKg: null,
      startDate: null,
      targetWeightKg: null,
      targetWaistCm: null,
      targetChestCm: null,
      targetShoulderCm: null,
      targetArmCm: null,
      targetDate: null,
      dailyCalorieTarget: 1900,
      updatedAt: null,
    });

    renderTodayPage();

    await waitFor(() => expect(screen.getByText('450 / 1900')).toBeTruthy());
    // Ba lời gọi (body-log/meals/goal) độc lập nhau (SPEC §2) — không giả
    // định thứ tự resolve giữa chúng, đợi riêng giá trị của BodyLogForm.
    await waitFor(() =>
      expect((screen.getByLabelText('Cân nặng (kg)') as HTMLInputElement).value).toBe('70'),
    );
    expect((screen.getByLabelText('Vòng bụng (cm)') as HTMLInputElement).value).toBe('85');
  });
});

describe('TodayPage — chặn đổi ngày khi còn thay đổi chưa lưu', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // `user.clear()` trên `<input type="date">` phát ra một onChange với giá trị
  // rỗng; `DatePicker` cố ý bỏ qua giá trị rỗng (`if (event.target.value)`,
  // không được sửa ở task này). Với input controlled, việc bỏ qua đó khiến
  // React ghi đè DOM về giá trị cũ ngay lần sự kiện kế tiếp, nên gõ tiếp theo
  // không bao giờ tạo ra một ngày hợp lệ — `confirm` không được gọi vì
  // `onChange` của DatePicker không bao giờ nhận đủ ngày mới. Test thật cần
  // thấy `onChange` chạy với ngày ĐÃ ĐỦ, nên đặt giá trị mới trong một lần
  // `fireEvent.change` (đúng như một `<input type="date">` thật gửi khi người
  // dùng gõ xong cả ba ô ngày/tháng/năm), không mô phỏng gõ từng phím.
  function changeDate(next: string) {
    fireEvent.change(screen.getByLabelText('Ngày'), { target: { value: next } });
  }

  it('đang sạch → đổi ngày KHÔNG hỏi', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTodayPage();

    await screen.findByLabelText('Ngày');
    changeDate('2026-08-10');

    // Hỏi thừa thì người dùng sẽ bấm bừa, và lớp chặn mất tác dụng.
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('đang bẩn, bấm HUỶ → ngày KHÔNG đổi', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    renderTodayPage();

    await screen.findByLabelText('Vòng ngực (cm)');
    await user.type(screen.getByLabelText('Vòng ngực (cm)'), '98');

    const before = (screen.getByLabelText('Ngày') as HTMLInputElement).value;
    changeDate('2026-08-10');

    expect(confirmSpy).toHaveBeenCalled();
    // Ca dễ sai nhất cả đợt: hỏi rồi vẫn đổi = mất dữ liệu ĐÚNG LÚC người dùng
    // vừa nói là không muốn mất.
    expect((screen.getByLabelText('Ngày') as HTMLInputElement).value).toBe(before);
  });

  it('đang bẩn, bấm ĐỒNG Ý → ngày đổi', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderTodayPage();

    await screen.findByLabelText('Vòng ngực (cm)');
    await user.type(screen.getByLabelText('Vòng ngực (cm)'), '98');

    changeDate('2026-08-10');

    await waitFor(() =>
      expect((screen.getByLabelText('Ngày') as HTMLInputElement).value).toBe('2026-08-10'),
    );
  });
});

/** Dùng chung cho hai describe dưới — nội dung không liên quan tới điều đang test,
 * chỉ cần mount trang không lỗi. */
const EMPTY_GOAL = {
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

function mockEmptyToday() {
  vi.mocked(todayApi.getBodyLog).mockResolvedValue(null);
  vi.mocked(todayApi.getMeals).mockResolvedValue([]);
  vi.mocked(todayApi.getGoal).mockResolvedValue(EMPTY_GOAL);
}

// I1 (báo cáo review): guard 2 và guard 3 không có test nào — xoá hẳn effect tương
// ứng ở `TodayPage.tsx` mà cả bộ 268 test vẫn xanh. Hai describe dưới khoá lại đúng
// hành vi spec §5.5 mô tả cho hai lớp chặn đó.
describe('TodayPage — chặn điều hướng trong app khi còn thay đổi chưa lưu (spec §5.5 lớp 2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Route thứ hai + một link thật tới nó, giống `NavLink` của `AppLayout` (mọi tab
   * điều hướng trong app đều là <a> đi qua router — xem final-review.md dòng 27-29),
   * để bấm "Biểu đồ" tạo ra một lần điều hướng router thật mà `useBlocker` thấy được. */
  function renderWithChartsLink() {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          element: (
            <>
              <Link to="/charts">Biểu đồ</Link>
              <TodayPage />
            </>
          ),
        },
        { path: '/charts', element: <div>Trang biểu đồ</div> },
      ],
      { initialEntries: ['/'] },
    );
    render(<RouterProvider router={router} />);
    return router;
  }

  it('đang bẩn, bấm sang Biểu đồ, bấm HUỶ → hỏi, và KHÔNG điều hướng', async () => {
    mockEmptyToday();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    const router = renderWithChartsLink();

    await screen.findByLabelText('Vòng ngực (cm)');
    await user.type(screen.getByLabelText('Vòng ngực (cm)'), '98');

    await user.click(screen.getByRole('link', { name: 'Biểu đồ' }));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    // Ca dễ sai nhất, đúng như ca tương tự ở lớp chặn 1 (đổi ngày): hỏi rồi vẫn điều
    // hướng = mất dữ liệu ĐÚNG LÚC người dùng vừa nói là không muốn mất.
    expect(router.state.location.pathname).toBe('/');
    expect(screen.getByLabelText('Vòng ngực (cm)')).toBeTruthy();
  });

  it('đang bẩn, bấm sang Biểu đồ, bấm ĐỒNG Ý → điều hướng sang /charts', async () => {
    mockEmptyToday();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    const router = renderWithChartsLink();

    await screen.findByLabelText('Vòng ngực (cm)');
    await user.type(screen.getByLabelText('Vòng ngực (cm)'), '98');

    await user.click(screen.getByRole('link', { name: 'Biểu đồ' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/charts'));
  });
});

describe('TodayPage — cảnh báo đóng tab / tải lại khi còn thay đổi chưa lưu (spec §5.5 lớp 3)', () => {
  it('đang sạch → dispatch "beforeunload" KHÔNG bị chặn', async () => {
    mockEmptyToday();
    renderTodayPage();
    await screen.findByLabelText('Vòng ngực (cm)');

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    // Hỏi thừa lúc không có gì để mất dạy người dùng bấm qua mà không đọc (SPEC §5.5).
    expect(event.defaultPrevented).toBe(false);
  });

  it('đang bẩn → dispatch "beforeunload" BỊ chặn (preventDefault)', async () => {
    mockEmptyToday();
    const user = userEvent.setup();
    renderTodayPage();

    await screen.findByLabelText('Vòng ngực (cm)');
    await user.type(screen.getByLabelText('Vòng ngực (cm)'), '98');

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});
