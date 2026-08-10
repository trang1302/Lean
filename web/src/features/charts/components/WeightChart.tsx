// Biểu đồ cân nặng — điểm thô mờ + đường MA7 đậm + ReferenceLine mục tiêu
// (SPEC §3.2). Nơi sống của cạm bẫy §4.1 (MA7 nổi bật hơn điểm thô) và §4.2
// (weightMa7 === null phải ngắt đoạn).
import {
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
import { formatDateShort, formatNullable } from '../../../lib/format';
import type { SummaryDay } from '../../../types/api';
import { countRealPoints } from '../utils/chartData';
import { CHART_COLORS, RAW_STROKE_OPACITY } from '../utils/chartColors';
import { ChartEmptyState } from './ChartEmptyState';
import { ChartTooltip, type ChartTooltipRow } from './ChartTooltip';
import s from './WeightChart.module.css';

interface WeightChartProps {
  days: SummaryDay[];
  targetWeightKg: number | null;
  /** CHỈ dùng trong test — Recharts `ResponsiveContainer` đo layout thật của
   * trình duyệt để biết width/height, mà jsdom không có layout (trả về 0),
   * nên trong môi trường test không có gì được vẽ nếu đi qua nó (đã kiểm
   * bằng spike thủ công trước khi viết component này — xem báo cáo). Truyền
   * kích thước cố định ở đây để test render thẳng `ComposedChart`, bỏ qua
   * `ResponsiveContainer`. Trang thật KHÔNG truyền prop này (PLAN §5.3 /
   * ghi chú B6 của điều phối viên). */
  testDimensions?: { width: number; height: number };
}

/** Ngưỡng "đủ dữ liệu để vẽ xu hướng" (SPEC §6): đếm số ngày có `weightKg`
 * thật, KHÔNG dùng `days.length` (không bao giờ rỗng, không phản ánh có dữ
 * liệu hay không — SPEC §2.2/§6). Dùng `weightKg` (số đo thô) chứ không
 * `weightMa7` — quyết định tự chốt: SPEC §6 chấp nhận cả hai ("đếm số ngày
 * có weightMa7 !== null (hoặc tối thiểu, số ngày có weightKg !== null ≥
 * 2)"); chọn `weightKg` vì đó là ngưỡng THẤP NHẤT nêu trong spec — người
 * dùng ghi đúng 2 ngày liên tiếp sẽ thấy MỘT đoạn MA7 ngắn ngay, thay vì
 * tiếp tục thấy thông báo rỗng cho tới khi MA7 tự nhiên xuất hiện ở đâu đó
 * trong cửa sổ 7 ngày. */
const MIN_POINTS_FOR_TREND = 2;

export function WeightChart({ days, targetWeightKg, testDimensions }: WeightChartProps) {
  if (countRealPoints(days, 'weightKg') < MIN_POINTS_FOR_TREND) {
    return <ChartEmptyState />;
  }

  const chart = (
    <ComposedChart data={days} {...testDimensions}>
      <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
      <XAxis dataKey="date" tickFormatter={formatDateShort} />
      {/* Domain KHÔNG bắt đầu từ 0 (SPEC §5.1) — cân nặng quanh 70kg, kéo về
          0 sẽ biến một đợt giảm 3kg thành một đường gần phẳng. */}
      <YAxis domain={['dataMin - 1', 'dataMax + 1']} unit="kg" />
      <Tooltip
        content={({ active, label, payload }) => {
          const point = payload?.[0]?.payload as SummaryDay | undefined;
          return (
            <ChartTooltip active={active} label={label} rows={point ? buildWeightTooltipRows(point) : []} />
          );
        }}
      />
      <Legend />
      {targetWeightKg !== null ? (
        <ReferenceLine
          y={targetWeightKg}
          stroke={CHART_COLORS.referenceLine}
          strokeDasharray="4 4"
          label={{ value: 'Mục tiêu', position: 'insideTopLeft', fill: CHART_COLORS.referenceLine }}
          // Mặc định của Recharts (`ifOverflow="discard"`) ÂM THẦM không vẽ
          // đường này nếu `targetWeightKg` nằm ngoài domain hiện có của
          // YAxis — đúng lúc người dùng CẦN thấy nó nhất (mục tiêu còn xa
          // so với hiện tại). `extendDomain` nới domain để đường luôn hiện,
          // đổi lại có thể làm khoảng trục rộng hơn mức tối thiểu của §5.1
          // khi mục tiêu cách xa dữ liệu — đánh đổi có chủ đích: "thấy mục
          // tiêu ở đâu" quan trọng hơn "trục vừa khít nhất có thể" cho biểu
          // đồ CÓ mục tiêu.
          ifOverflow="extendDomain"
        />
      ) : null}
      {/* Thứ tự khai báo quyết định thứ tự vẽ trong Recharts (SPEC §4.1) —
          điểm thô khai TRƯỚC để đường MA7 nằm TRÊN khi hai đường chạm nhau. */}
      <Line
        type="monotone"
        dataKey="weightKg"
        name="Số đo từng ngày"
        // `className` chỉ để test tìm đúng lớp SVG bằng chọn lọc DOM (SPEC
        // §4.1 — kiểm thứ tự vẽ), không ảnh hưởng hình dạng render.
        className="chart-line-raw"
        stroke={CHART_COLORS.raw}
        strokeOpacity={RAW_STROKE_OPACITY}
        strokeDasharray="3 3"
        strokeWidth={1.5}
        dot={{ r: 2, fill: CHART_COLORS.raw, fillOpacity: RAW_STROKE_OPACITY }}
        activeDot={{ r: 3 }}
        isAnimationActive={false}
        // SPEC §4.2: mặc định của Recharts 3 đã là `false` — ghi tường minh
        // để lần sau có người định "sửa cho mượt" phải đọc comment này
        // trước. Cửa sổ MA7 dưới 2 điểm phải để lại LỖ HỔNG thật trên biểu
        // đồ, không nối thẳng qua — nối qua là vẽ ra một xu hướng không có
        // thật đúng ở đoạn người dùng nghỉ cân vài ngày.
        connectNulls={false}
      />
      <Line
        type="monotone"
        dataKey="weightMa7"
        name="Trung bình 7 ngày"
        className="chart-line-ma7"
        stroke={CHART_COLORS.trend}
        strokeWidth={2.5}
        dot={false}
        activeDot={{ r: 4 }}
        isAnimationActive={false}
        connectNulls={false} // xem comment ở Line phía trên — cùng lý do, SPEC §4.2
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

/** Dựng các dòng tooltip cho một điểm dữ liệu — tách riêng để test không
 * cần render Recharts (Tooltip `content` là một hàm nhận `payload` runtime,
 * khó unit test trực tiếp; hàm thuần này là phần logic thật bên trong nó). */
export function buildWeightTooltipRows(day: Pick<SummaryDay, 'weightKg' | 'weightMa7'>): ChartTooltipRow[] {
  return [
    { label: 'Số đo hôm đó', value: formatNullable(day.weightKg, 'kg') },
    { label: 'Trung bình 7 ngày', value: formatNullable(day.weightMa7, 'kg') },
  ];
}
