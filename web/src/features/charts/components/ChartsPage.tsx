// Trang "Biểu đồ" — lắp RangePicker + ba biểu đồ + thẻ tiến độ mục tiêu.
// Sống bằng ĐÚNG MỘT request `GET /api/summary` qua `useCharts` (SPEC §2) —
// không tự gọi thêm `/body-logs`, `/meals`, `/goal` nào ở đây.
import { ErrorState, LoadingState } from '../../../components/shared';
import { useCharts } from '../hooks/useCharts';
import { CaloriesChart } from './CaloriesChart';
import { GoalProgressCard } from './GoalProgressCard';
import { RangePicker } from './RangePicker';
import { WaistChart } from './WaistChart';
import { WeightChart } from './WeightChart';
import s from './ChartsPage.module.css';

export function ChartsPage() {
  const { range, setRange, from, to, data, error, reload } = useCharts();

  // Thứ tự kiểm CỐ Ý: lỗi trước, rồi "chưa có data" (đang tải lần đầu) —
  // cùng quy ước với `GoalSettingsSection`/`SettingsPage` (web-settings).
  // `useApiResource` giữ `data` cũ khi có lỗi ở một lần tải LẠI (đổi
  // khoảng), nhưng ở đây ưu tiên báo lỗi rõ ràng hơn là hiện dữ liệu cũ
  // cạnh một khoảng ngày mới đã đổi — tránh người dùng đọc nhầm dữ liệu của
  // khoảng trước là của khoảng đang chọn.
  if (error) {
    return (
      <div className={s.page}>
        <PageHeader range={range} onRangeChange={setRange} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={s.page}>
        <PageHeader range={range} onRangeChange={setRange} />
        <LoadingState label="Đang tải dữ liệu biểu đồ…" />
      </div>
    );
  }

  return (
    <div className={s.page}>
      <PageHeader range={range} onRangeChange={setRange} />

      <div className={s.grid}>
        <section className={s.chartSection} aria-label="Biểu đồ cân nặng">
          <h2 className={s.sectionHeading}>Cân nặng</h2>
          <WeightChart days={data.days} targetWeightKg={data.goal.targetWeightKg} />
        </section>

        <section className={s.chartSection} aria-label="Biểu đồ vòng bụng">
          <h2 className={s.sectionHeading}>Vòng bụng</h2>
          <WaistChart days={data.days} />
        </section>

        <section className={s.chartSection} aria-label="Biểu đồ calo">
          <h2 className={s.sectionHeading}>Calo</h2>
          <CaloriesChart
            days={data.days}
            weeks={data.weeks}
            from={from}
            to={to}
            dailyCalorieTarget={data.goal.dailyCalorieTarget}
          />
        </section>

        <GoalProgressCard goal={data.goal} />
      </div>
    </div>
  );
}

interface PageHeaderProps {
  range: ReturnType<typeof useCharts>['range'];
  onRangeChange: (range: ReturnType<typeof useCharts>['range']) => void;
}

function PageHeader({ range, onRangeChange }: PageHeaderProps) {
  return (
    <div className={s.header}>
      <h1 className={s.heading}>Biểu đồ</h1>
      <RangePicker value={range} onChange={onRangeChange} />
    </div>
  );
}
