// Hằng màu cho ba biểu đồ. Giá trị hex CỐ Ý lặp lại (không import) từ
// `web/src/styles/tokens.css` — feature này KHÔNG được đụng `styles/` (ranh
// giới sở hữu của điều phối viên), và Recharts nhận `stroke`/`fill` như
// thuộc tính SVG thô, không đọc `var(--…)` một cách đáng tin cậy qua mọi
// trình duyệt. Đây là kiểu lặp có chủ đích, cùng loại với `todayIso()` lặp
// giữa client/server (lib/format.ts) — hai nơi độc lập, không chia sẻ
// runtime, không phải trùng lặp cẩu thả. Đổi màu ở `tokens.css` thì đổi ở
// đây theo, việc này nằm trong "thứ cần ở thư mục dùng chung" ghi trong báo
// cáo (đề xuất chuyển sang biến CSS thật nếu `styles/` mở quyền cho charts).
//
// Quy tắc màu áp dụng cho cả hai biểu đồ cân nặng/vòng bụng (SPEC §4.1):
// đường MA7 dùng màu đậm nhất (primary), điểm thô dùng màu mờ, độ đục thấp
// — không phải vấn đề thẩm mỹ, đây LÀ cơ chế thực thi cạm bẫy "MA7 phải nổi
// bật hơn điểm thô".

export const CHART_COLORS = {
  /** Đường MA7 (nhân vật chính) — cân nặng và vòng bụng. */
  trend: '#2563eb', // = --color-primary
  /** Điểm thô (bằng chứng phụ) — cùng màu nền nhưng mờ, xem `RAW_STROKE_OPACITY`. */
  raw: '#52606d', // = --color-text-muted
  /** `ReferenceLine` mục tiêu (cân nặng, calo) — trung tính, không mang
   * nghĩa "lỗi"/"nguy hiểm" nên KHÔNG dùng --color-danger. */
  referenceLine: '#1f2933', // = --color-text
  /** Cột calo theo ngày. */
  caloriesBar: '#2563eb', // = --color-primary
  /** Đường trung bình tuần chồng lên cột calo — phải tách biệt rõ với màu cột. */
  weeklyAvgLine: '#1f2933', // = --color-text
  /** Lưới nền — nhạt, không cạnh tranh với dữ liệu. */
  grid: '#e4e7eb',
} as const;

/** Độ đục của điểm thô (SPEC §4.1: đề xuất 0.25–0.35). */
export const RAW_STROKE_OPACITY = 0.3;
