// Biểu đồ calo — cột theo ngày + ReferenceLine mục tiêu ngày + đường trung
// bình tuần (SPEC §3.4). Nơi sống của cạm bẫy §4.3 (avgCalories === null
// khác hẳn 0) và §4.4 (tuần cắt cụt, phương án A — xem
// `utils/chartData.ts#buildCaloriesChartData`).
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDateShort, formatNumber } from '../../../lib/format';
import type { SummaryDay, SummaryWeek } from '../../../types/api';
import { buildCaloriesChartData, type CaloriesChartDatum, hasCalorieData } from '../utils/chartData';
import { CHART_COLORS } from '../utils/chartColors';
import { ChartEmptyState } from './ChartEmptyState';
import { ChartTooltip, type ChartTooltipRow } from './ChartTooltip';
import s from './CaloriesChart.module.css';

interface CaloriesChartProps {
  days: SummaryDay[];
  weeks: SummaryWeek[];
  from: string;
  to: string;
  dailyCalorieTarget: number | null;
  /** Xem docstring cùng tên ở `WeightChart.tsx` — CHỈ dùng trong test. */
  testDimensions?: { width: number; height: number };
}

export function CaloriesChart({ days, weeks, from, to, dailyCalorieTarget, testDimensions }: CaloriesChartProps) {
  // Trạng thái rỗng riêng của biểu đồ calo (SPEC §6): `totalCalories`/
  // `mealCount` KHÔNG BAO GIỜ null (không dùng `countRealPoints`) — "chưa
  // có dữ liệu" nghĩa là mọi ngày `mealCount === 0`.
  if (!hasCalorieData(days)) {
    return <ChartEmptyState />;
  }

  const data = buildCaloriesChartData(days, weeks, from, to);

  const chart = (
    <ComposedChart data={data} {...testDimensions}>
      <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
      <XAxis dataKey="date" tickFormatter={formatDateShort} />
      {/* Cột calo PHẢI bắt đầu từ 0 (SPEC §5.1) — ngược với cân nặng/vòng
          bụng, ở đây chiều cao cột là thứ người dùng so sánh trực tiếp. */}
      <YAxis domain={[0, 'auto']} />
      <Tooltip
        content={({ active, label, payload }) => {
          const point = payload?.[0]?.payload as CaloriesChartDatum | undefined;
          return (
            <ChartTooltip active={active} label={label} rows={point ? buildCaloriesTooltipRows(point) : []} />
          );
        }}
      />
      <Legend />
      {dailyCalorieTarget !== null ? (
        <ReferenceLine
          y={dailyCalorieTarget}
          stroke={CHART_COLORS.referenceLine}
          strokeDasharray="4 4"
          label={{ value: 'Mục tiêu', position: 'insideTopLeft', fill: CHART_COLORS.referenceLine }}
          // Cùng lý do như `WeightChart` — domain `[0, 'auto']` chỉ tính từ
          // `totalCalories`; nếu mục tiêu calo cao/thấp hơn hẳn mọi ngày đã
          // ghi, mặc định `ifOverflow="discard"` sẽ âm thầm không vẽ đường
          // này. `extendDomain` đảm bảo mục tiêu luôn hiện.
          ifOverflow="extendDomain"
        />
      ) : null}
      <Bar
        dataKey="totalCalories"
        name="Calo mỗi ngày"
        className="chart-bar-calories"
        fill={CHART_COLORS.caloriesBar}
        isAnimationActive={false}
      />
      <Line
        type="stepAfter"
        dataKey="weekAvgCalories"
        name="Trung bình tuần"
        className="chart-line-weekly-avg"
        stroke={CHART_COLORS.weeklyAvgLine}
        strokeWidth={2}
        dot={false}
        isAnimationActive={false}
        // SPEC §4.3: tuần không ghi bữa nào (hoặc tuần cắt cụt, SPEC §4.4)
        // phải là một LỖ HỔNG thật trên đường trung bình — nối qua là vẽ ra
        // một xu hướng ăn uống không có thật đúng ở tuần bị bỏ trống.
        connectNulls={false}
      />
    </ComposedChart>
  );

  return (
    <div className={s.chartWrapper}>
      {testDimensions ? (
        chart
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          {chart}
        </ResponsiveContainer>
      )}
    </div>
  );
}

/**
 * Dựng dòng tooltip cho một ngày của biểu đồ calo. Hai chỗ dễ nói dối nếu
 * làm cẩu thả (SPEC §4.3):
 *   - Ngày `mealCount === 0` KHÔNG được nói "0 kcal" — đó là "chưa ghi bữa
 *     nào", khác hẳn "0 kcal vì nhịn ăn có chủ đích" mà một ngày ghi đủ
 *     bữa nhưng ăn rất ít vẫn có thể ra một số khác 0 rất nhỏ.
 *   - `weekAvgCaloriesRaw === null` (tuần thật sự không ghi bữa) phải nói
 *     "Không ghi bữa nào", KHÔNG phải "0 kcal". Dùng `weekAvgCaloriesRaw`
 *     (không phải `weekAvgCalories`) vì trường đó phản ánh SỰ THẬT của cả
 *     tuần, không bị ảnh hưởng bởi việc tuần này có bị loại khỏi ĐƯỜNG VẼ
 *     vì cắt cụt hay không (SPEC §4.4) — một tuần cắt cụt nhưng có ăn thật
 *     không được tooltip báo nhầm thành "không ghi bữa nào".
 */
export function buildCaloriesTooltipRows(day: CaloriesChartDatum): ChartTooltipRow[] {
  const dailyValue = day.mealCount === 0 ? 'Chưa ghi bữa nào' : `${formatNumber(day.totalCalories)} kcal`;
  const weeklyValue =
    day.weekAvgCaloriesRaw === null ? 'Không ghi bữa nào' : `${formatNumber(day.weekAvgCaloriesRaw)} kcal`;
  return [
    { label: 'Calo hôm đó', value: dailyValue },
    { label: 'Trung bình tuần', value: weeklyValue },
  ];
}
