// Kiểu của MỌI response API, chép tay từ SPEC của feature backend tương ứng
// (docs/features/{body-logs,meals,goal,summary}/SPEC.md). Không có bước sinh
// type tự động — đổi response ở backend là phải sửa file này cùng lúc.
// Xem docs/features/web-shell/SPEC.md §3.4.
//
// Cố ý CHƯA có SessionUser/SessionResponse: feature `auth` chưa có code chạy
// (server/src/features/ không có auth/), nên chép hình dạng response của nó
// bây giờ là suy diễn, không phải chép tay. Thêm khi `features/auth/` dựng
// (Bước 8 của web-shell/PLAN.md).

// ---------------------------------------------------------------------------
// body-logs — docs/features/body-logs/SPEC.md §2
// ---------------------------------------------------------------------------

export interface BodyLog {
  date: string; // "YYYY-MM-DD" — không bao giờ là Date/DateTime
  weightKg: number | null;
  waistCm: number | null;
  note: string | null;
  createdAt: string; // ISO 8601 — thời điểm thật
  updatedAt: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// meals — docs/features/meals/SPEC.md §2
// ---------------------------------------------------------------------------

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Meal {
  id: string; // cuid
  date: string; // "YYYY-MM-DD"
  slot: MealSlot;
  name: string;
  calories: number;
  note: string | null;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// goal — docs/features/goal/SPEC.md §2
// ---------------------------------------------------------------------------

export interface Goal {
  targetWeightKg: number | null;
  targetDate: string | null; // "YYYY-MM-DD"
  dailyCalorieTarget: number | null;
  updatedAt: string | null; // ISO 8601 — null khi chưa từng ghi mục tiêu
}

// ---------------------------------------------------------------------------
// summary — docs/features/summary/SPEC.md §2
// ---------------------------------------------------------------------------

export interface SummaryDay {
  date: string; // "YYYY-MM-DD" — không bao giờ null
  weightKg: number | null;
  weightMa7: number | null; // null khi cửa sổ MA7 có dưới 2 giá trị
  waistCm: number | null;
  waistMa7: number | null;
  totalCalories: number; // không bao giờ null — ngày không ghi bữa là 0
  mealCount: number; // 0 khi không ghi bữa nào
}

export interface SummaryWeek {
  weekStart: string; // "YYYY-MM-DD" — thứ Hai của tuần, không bao giờ null
  avgCalories: number | null; // null khi cả tuần không ghi bữa nào
  avgWeightKg: number | null; // null khi cả tuần không có số đo cân nặng nào
}

export interface SummaryGoal {
  targetWeightKg: number | null;
  targetDate: string | null;
  dailyCalorieTarget: number | null;
  currentMa7WeightKg: number | null;
  remainingKg: number | null;
  currentRateKgPerWeek: number | null;
  requiredRateKgPerWeek: number | null;
  onTrack: boolean | null;
}

export interface SummaryResponse {
  days: SummaryDay[];
  weeks: SummaryWeek[];
  goal: SummaryGoal;
}

// ---------------------------------------------------------------------------
// Hình dạng lỗi chung — docs/overview/04-conventions.md,
// server/src/shared/errors/errorHandler.ts
// ---------------------------------------------------------------------------

export interface FieldError {
  path: string;
  message: string;
}

/**
 * Lỗi HTTP đã dịch từ response `{ error: { code, message, fields? } }` của
 * server. Mọi status >= 400 đi qua `apiClient` (web/src/lib/apiClient.ts)
 * ném ra đúng loại này — không bao giờ bẹp thành `new Error(message)` trần,
 * vì `fields[]` phải tới được từng ô nhập ở tầng UI.
 *
 * `status: 0` + `code: 'NETWORK_ERROR'` là ca riêng của apiClient: mất mạng,
 * server chưa bật, hoặc phản hồi không phải JSON hợp lệ — không phải một mã
 * lỗi HTTP thật, nhưng dùng chung hình dạng này để UI chỉ cần MỘT kiểu catch.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: FieldError[];

  constructor(status: number, code: string, message: string, fields?: FieldError[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    if (fields) this.fields = fields;
  }
}
