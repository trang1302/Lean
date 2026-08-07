import { describe, expect, it } from 'vitest';
import { MEAL_SLOTS, SLOT_LABEL } from './meals';

describe('MEAL_SLOTS', () => {
  it('đúng thứ tự theo giờ ăn: sáng → trưa → tối → phụ', () => {
    expect(MEAL_SLOTS).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
  });

  it('khớp slotSchema của server (server/src/shared/validation/commonSchemas.ts) — ' +
    'danh sách chép tay dưới đây phải được cập nhật thủ công nếu server đổi enum, ' +
    'vì client không import được code server (khác runtime)', () => {
    // Chép tay từ:
    //   export const slotSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
    // server/src/shared/validation/commonSchemas.ts
    const SERVER_SLOT_SCHEMA_VALUES = ['breakfast', 'lunch', 'dinner', 'snack'];
    expect([...MEAL_SLOTS]).toEqual(SERVER_SLOT_SCHEMA_VALUES);
  });

  it('mỗi slot có đúng một nhãn tiếng Việt trong SLOT_LABEL', () => {
    for (const slot of MEAL_SLOTS) {
      expect(SLOT_LABEL[slot]).toBeTruthy();
    }
  });
});
