// Nguồn thứ tự buổi ăn DUY NHẤT của `web/` — dùng cho cả dropdown chọn buổi
// và thứ tự nhóm của `MealList` (docs/features/web-today/SPEC.md §5.3).
// Xem docs/features/web-shell/SPEC.md §3.4.

import type { MealSlot } from '../types/api';

/**
 * Thứ tự THEO GIỜ ĂN, không phải bảng chữ cái — sáng → trưa → tối → phụ.
 * `slot` là cột `String` trong SQLite (prisma/schema.prisma), nên
 * `orderBy: { slot: 'asc' }` ở server cho ra `breakfast, dinner, lunch,
 * snack` (đúng thứ tự chữ cái, SAI thứ tự bữa ăn). Vì vậy thứ tự đúng
 * PHẢI do client quyết định bằng mảng tường minh này, không được suy ra
 * từ bất kỳ `sort()`/`orderBy` nào.
 *
 * Giá trị phải khớp `slotSchema` của server
 * (server/src/shared/validation/commonSchemas.ts) — hai bản riêng biệt có
 * chủ đích (client/server khác runtime, không chia sẻ module được), nên
 * lệch giá trị là lỗi câm. Test khóa bằng cách so với danh sách chép tay.
 */
export const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Nhãn tiếng Việt hiển thị cho từng buổi. */
export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Sáng',
  lunch: 'Trưa',
  dinner: 'Tối',
  snack: 'Phụ',
};
