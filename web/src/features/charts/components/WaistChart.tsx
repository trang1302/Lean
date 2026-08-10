// Biểu đồ vòng bụng — cùng cách trình bày với `WeightChart` (điểm thô mờ +
// MA7 đậm), nhưng KHÔNG có `ReferenceLine` mục tiêu: model `Goal` không có
// trường vòng bụng (docs/overview/02-data-model.md, SPEC §3.3) — bịa ra một
// đường ngang ở đây là hiển thị một mục tiêu không tồn tại.
//
// Trùng lặp với `WeightChart` là CÓ CHỦ ĐÍCH ở bước đầu (PLAN §2: "chấp
// nhận trùng lặp ở bước đầu; chỉ trừu tượng hóa... sau khi cả hai đã chạy
// đúng và thấy rõ chỗ khác nhau"). Không tự trừu tượng hóa sớm.
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDateShort, formatNullable } from '../../../lib/format';
import type { SummaryDay } from '../../../types/api';
import { countRealPoints } from '../utils/chartData';
import { CHART_COLORS, RAW_STROKE_OPACITY } from '../utils/chartColors';
import { ChartEmptyState } from './ChartEmptyState';
import { ChartTooltip, type ChartTooltipRow } from './ChartTooltip';
import s from './WaistChart.module.css';

interface WaistChartProps {
  days: SummaryDay[];
  /** Xem docstring cùng tên ở `WeightChart.tsx` — CHỈ dùng trong test. */
  testDimensions?: { width: number; height: number };
}

/** Cùng ngưỡng và cùng lý do chọn `waistCm` (không phải `waistMa7`) như
 * `WeightChart` — xem comment ở đó. */
const MIN_POINTS_FOR_TREND = 2;

export function WaistChart({ days, testDimensions }: WaistChartProps) {
  if (countRealPoints(days, 'waistCm') < MIN_POINTS_FOR_TREND) {
    return <ChartEmptyState />;
  }

  const chart = (
    <ComposedChart data={days} {...testDimensions}>
      <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
      <XAxis dataKey="date" tickFormatter={formatDateShort} />
      <YAxis domain={['dataMin - 1', 'dataMax + 1']} unit="cm" />
      <Tooltip
        content={({ active, label, payload }) => {
          const point = payload?.[0]?.payload as SummaryDay | undefined;
          return (
            <ChartTooltip active={active} label={label} rows={point ? buildWaistTooltipRows(point) : []} />
          );
        }}
      />
      <Legend />
      {/* Điểm thô khai TRƯỚC, MA7 khai SAU — cùng quy tắc thứ tự vẽ của
          SPEC §4.1, áp dụng y nguyên cho vòng bụng. */}
      <Line
        type="monotone"
        dataKey="waistCm"
        name="Số đo từng ngày"
        className="chart-line-raw"
        stroke={CHART_COLORS.raw}
        strokeOpacity={RAW_STROKE_OPACITY}
        strokeDasharray="3 3"
        strokeWidth={1.5}
        dot={{ r: 2, fill: CHART_COLORS.raw, fillOpacity: RAW_STROKE_OPACITY }}
        activeDot={{ r: 3 }}
        isAnimationActive={false}
        connectNulls={false} // SPEC §4.2 — ngắt đoạn, không nội suy qua ngày thiếu số đo
      />
      <Line
        type="monotone"
        dataKey="waistMa7"
        name="Trung bình 7 ngày"
        className="chart-line-ma7"
        stroke={CHART_COLORS.trend}
        strokeWidth={2.5}
        dot={false}
        activeDot={{ r: 4 }}
        isAnimationActive={false}
        connectNulls={false} // SPEC §4.2 — cửa sổ MA7 dưới 2 giá trị phải để lại lỗ hổng thật
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

export function buildWaistTooltipRows(day: Pick<SummaryDay, 'waistCm' | 'waistMa7'>): ChartTooltipRow[] {
  return [
    { label: 'Số đo hôm đó', value: formatNullable(day.waistCm, 'cm') },
    { label: 'Trung bình 7 ngày', value: formatNullable(day.waistMa7, 'cm') },
  ];
}
