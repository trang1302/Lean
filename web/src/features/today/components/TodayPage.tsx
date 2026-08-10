import { useState } from 'react';
import { Card } from '../../../components/ui';
import { ErrorState, LoadingState } from '../../../components/shared';
import { todayIso } from '../../../lib/format';
import { useTodayData } from '../hooks/useTodayData';
import { BodyLogForm } from './BodyLogForm';
import { CalorieSummaryCard } from './CalorieSummaryCard';
import { DatePicker } from './DatePicker';
import { MealList } from './MealList';
import { MealQuickAddForm } from './MealQuickAddForm';
import s from './TodayPage.module.css';

/**
 * Trang "Hôm nay" — điểm vào duy nhất của feature `web-today`
 * (docs/features/web-today/SPEC.md §1, §4). Giữ state `date`, lắp bốn
 * khối theo đúng bố cục §4: DatePicker → BodyLogForm → MealList +
 * MealQuickAddForm → CalorieSummaryCard.
 *
 * `goalError` (lỗi thật khi nạp `GET /goal`, KHÔNG BAO GIỜ là `404` — SPEC
 * §2.6) không có khối lỗi riêng: card tính tổng calo vẫn hiển thị được mà
 * không cần mục tiêu, nên khi nạp mục tiêu lỗi, trang coi như
 * `dailyCalorieTarget = null` (giống "chưa đặt mục tiêu") thay vì chặn cả
 * card bằng một `ErrorState`. Đây là quyết định tự chốt — xem báo cáo.
 */
export function TodayPage() {
  const [date, setDate] = useState(todayIso());
  const data = useTodayData(date);

  const mealsShowLoading = data.mealsLoading && data.meals.length === 0 && !data.mealsError;

  return (
    <div className={s.page}>
      {/*
        Mỗi trang phải có đúng một <h1>. `ChartsPage` và `SettingsPage` đã có;
        trang này thiếu vì nó mở đầu bằng `DatePicker`. Người dùng trình đọc
        màn hình điều hướng bằng danh sách tiêu đề — thiếu <h1> là mất mốc
        định vị, họ không biết đang ở trang nào.
      */}
      <h1 className={s.heading}>Hôm nay</h1>
      <DatePicker value={date} onChange={setDate} />

      {data.bodyLogError ? (
        <ErrorState error={data.bodyLogError} onRetry={data.reloadBodyLog} />
      ) : (
        <BodyLogForm date={date} bodyLog={data.bodyLog} isLoading={data.bodyLogLoading} />
      )}

      <Card heading="Bữa ăn">
        {data.mealsError ? (
          <ErrorState error={data.mealsError} onRetry={data.reloadMeals} />
        ) : mealsShowLoading ? (
          <LoadingState label="Đang tải bữa ăn…" />
        ) : (
          <MealList meals={data.meals} onChanged={data.reloadMeals} />
        )}
        <MealQuickAddForm date={date} onCreated={data.reloadMeals} />
      </Card>

      <CalorieSummaryCard
        // Lỗi khi nạp meals → không cộng tổng từ dữ liệu CŨ có thể còn sót
        // lại trong `data.meals` (SPEC §7 câu hỏi 1 áp dụng ngược: tổng
        // luôn phải khớp danh sách đang hiển thị, ở đây là ErrorState).
        meals={data.mealsError ? [] : data.meals}
        dailyCalorieTarget={data.goal?.dailyCalorieTarget ?? null}
      />
    </div>
  );
}
