// Thẻ tiến độ mục tiêu (SPEC §3.5) — không phải biểu đồ, nhưng là thứ
// người dùng nhìn lâu nhất. Ba điều bắt buộc nhớ (SPEC §2.4):
//   1. `onTrack` có BA trạng thái (`true`/`false`/`null`), không phải hai —
//      `null` = "chưa đủ dữ liệu để kết luận", phải hiện khác hẳn `false`.
//   2. `remainingKg` LUÔN dương — hướng đọc từ dấu của `requiredRateKgPerWeek`,
//      không suy ra từ `remainingKg`.
//   3. Cả khối neo vào HÔM NAY, không neo vào khoảng đang xem (`from`/`to`
//      của RangePicker) — nhãn trên thẻ phải ghi rõ, nếu không người dùng
//      đọc nó như số liệu của khoảng đang xem.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { formatDateFull, formatNullable } from '../../../lib/format';
import type { SummaryGoal } from '../../../types/api';
import { Card } from '../../../components/ui';
import { EmptyState } from '../../../components/shared';
import s from './GoalProgressCard.module.css';

interface GoalProgressCardProps {
  goal: SummaryGoal;
}

interface MetricProps {
  label: string;
  value: ReactNode;
}

function Metric({ label, value }: MetricProps) {
  return (
    <div className={s.metric}>
      <dt className={s.metricLabel}>{label}</dt>
      <dd className={s.metricValue}>{value}</dd>
    </div>
  );
}

/** Ba trạng thái, không phải hai (xem comment đầu file). `null` PHẢI hiện
 * khác `false` — cả hai đều "chưa xong mục tiêu" nhưng mang ý nghĩa khác
 * nhau: `false` là kết luận đã có (đang lệch tiến độ), `null` là CHƯA THỂ
 * kết luận (thiếu dữ liệu). Gộp chung thành một kiểu "chưa đạt" sẽ nói với
 * người dùng một điều họ chưa hề chứng minh là đúng. */
function OnTrackBadge({ onTrack }: { onTrack: boolean | null }) {
  if (onTrack === null) {
    return <span className={s.badgeUnknown}>Chưa đủ dữ liệu để kết luận</span>;
  }
  return onTrack ? (
    <span className={s.badgeOnTrack}>Đúng tiến độ</span>
  ) : (
    <span className={s.badgeOffTrack}>Chưa đúng tiến độ</span>
  );
}

export function GoalProgressCard({ goal }: GoalProgressCardProps) {
  return (
    <Card heading="Tiến độ mục tiêu" className={s.card}>
      <p className={s.anchorNote}>
        Tính theo <strong>hôm nay</strong>, không theo khoảng ngày đang xem ở trên.
      </p>

      {goal.currentMa7WeightKg === null ? (
        <EmptyState message="Chưa đủ số đo cân nặng trong 7 ngày gần nhất để tính hiện trạng." />
      ) : (
        <>
          <dl className={s.metrics}>
            <Metric label="Hiện tại" value={formatNullable(goal.currentMa7WeightKg, 'kg')} />
            <Metric label="Tốc độ hiện tại" value={formatNullable(goal.currentRateKgPerWeek, 'kg/tuần')} />
            {goal.targetWeightKg !== null ? (
              <>
                <Metric label="Còn lại" value={formatNullable(goal.remainingKg, 'kg')} />
                <Metric label="Tốc độ cần thiết" value={formatNullable(goal.requiredRateKgPerWeek, 'kg/tuần')} />
              </>
            ) : null}
          </dl>

          {goal.targetWeightKg !== null ? (
            <div className={s.trackRow}>
              <OnTrackBadge onTrack={goal.onTrack} />
              {goal.targetDate !== null ? (
                <span className={s.targetDate}>Hạn: {formatDateFull(goal.targetDate)}</span>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {goal.targetWeightKg === null ? (
        <p className={s.cta}>
          Chưa đặt mục tiêu cân nặng. <Link to="/settings">Đặt mục tiêu ở trang Cài đặt</Link>.
        </p>
      ) : null}
    </Card>
  );
}
