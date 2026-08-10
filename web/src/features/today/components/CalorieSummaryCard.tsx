import { Card } from '../../../components/ui';
import { EmptyState } from '../../../components/shared';
import type { Meal } from '../../../types/api';
import s from './CalorieSummaryCard.module.css';

interface CalorieSummaryCardProps {
  meals: Meal[];
  dailyCalorieTarget: number | null;
}

/**
 * `tổng / mục tiêu` + thanh tiến độ (SPEC §4, §6). Tổng calo tính ở CLIENT
 * bằng cách cộng mảng `meals` — điều phối viên/SPEC §7 câu hỏi 1 đã chốt
 * phương án này (khớp danh sách ngay bên trên, không cần lời gọi thứ tư
 * tới `GET /summary`, tránh lệch nghĩa "hôm nay" giữa hai endpoint).
 *
 * Ba nguyên tắc bắt buộc của SPEC §6:
 * 1. `meals.length === 0` → "ngày trắng" cho phần calo — hiện lời mời ghi
 *    bữa đầu tiên, KHÔNG hiện `0` hay `0 / —` (SPEC §6 nguyên tắc 3), dù
 *    mục tiêu đã đặt hay chưa.
 * 2. `dailyCalorieTarget === null` (đã có bữa) → vẫn hiện tổng (sự thật,
 *    không phụ thuộc mục tiêu), KHÔNG vẽ thanh tiến độ, thay bằng lời mời
 *    đặt mục tiêu ở Cài đặt.
 * 3. Vượt mục tiêu → đổi màu cảnh báo; số phần trăm KHÔNG bị cắt ở 100%
 *    (chỉ chiều rộng thanh bị giới hạn 100%, số vẫn hiện đúng, vd. 120%).
 */
export function CalorieSummaryCard({ meals, dailyCalorieTarget }: CalorieSummaryCardProps) {
  if (meals.length === 0) {
    return (
      <Card heading="Tổng calo">
        <EmptyState message="Chưa ghi bữa nào — thêm bữa đầu tiên ở trên để xem tổng calo hôm nay." />
      </Card>
    );
  }

  const total = meals.reduce((sum, meal) => sum + meal.calories, 0);

  if (dailyCalorieTarget === null) {
    return (
      <Card heading="Tổng calo">
        <p className={s.total}>{total} calo</p>
        <p className={s.hint}>Đặt mục tiêu calo ở tab Cài đặt để thấy tiến độ.</p>
      </Card>
    );
  }

  const percent = dailyCalorieTarget > 0 ? Math.round((total / dailyCalorieTarget) * 100) : 0;
  const over = total > dailyCalorieTarget;
  const barWidth = Math.min(percent, 100);

  return (
    <Card heading="Tổng calo">
      <p className={s.total}>
        {total} / {dailyCalorieTarget}
      </p>
      <div className={s.barTrack}>
        <div
          className={[s.barFill, over ? s.over : ''].filter(Boolean).join(' ')}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <p className={s.percent}>{percent}%</p>
    </Card>
  );
}
