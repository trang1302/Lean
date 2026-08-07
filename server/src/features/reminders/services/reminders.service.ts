import { AppError } from '../../../shared/errors/AppError.js';
import {
  REMINDER_KINDS,
  isReminderKind,
  type ReminderKind,
  type UpdateReminderInput,
} from '../dtos/reminders.request.js';
import { toReminderView, type ReminderView } from '../dtos/reminders.response.js';
import {
  findAllReminders,
  upsertReminder,
  type ReminderRecord,
} from '../repositories/reminders.repository.js';

/**
 * Cấu hình mặc định cho loại chưa từng được lưu.
 *
 * `enabled: false` và `ntfyTopic: null` là chủ ý: không tự bật thông báo cho
 * người dùng chưa hề cấu hình topic. Giờ mặc định chỉ là gợi ý hiển thị sẵn
 * trên trang Cài đặt.
 */
const DEFAULTS: Record<ReminderKind, Omit<ReminderView, 'kind'>> = {
  weigh_in: { timeOfDay: '07:00', enabled: false, ntfyTopic: null },
  meal_log: { timeOfDay: '20:00', enabled: false, ntfyTopic: null },
};

function defaultView(kind: ReminderKind): ReminderView {
  return { kind, ...DEFAULTS[kind] };
}

/**
 * Luôn trả đủ mọi loại nhắc nhở, theo thứ tự khai báo ở `REMINDER_KINDS`.
 *
 * Không "seed" hàng vào DB khi đọc: ghi dữ liệu trong một request GET là bẫy
 * cổ điển. Loại chưa cấu hình đơn giản là hiện giá trị mặc định.
 */
export async function listReminders(): Promise<ReminderView[]> {
  const rows = await findAllReminders();
  const byKind = new Map<string, ReminderRecord>(rows.map((row) => [row.kind, row]));

  return REMINDER_KINDS.map((kind) => {
    const row = byKind.get(kind);
    return row ? toReminderView(row) : defaultView(kind);
  });
}

/**
 * Cập nhật một phần. Trường vắng mặt giữ nguyên giá trị cũ; `ntfyTopic: null`
 * mới là lệnh xóa — cùng quy ước với `PUT /body-logs/:date`.
 *
 * `kind` ngoài `REMINDER_KINDS` trả 404: tập loại nhắc nhở do spec §8 quy
 * định, người dùng không tự tạo loại mới.
 */
export async function updateReminder(
  kind: string,
  input: UpdateReminderInput,
): Promise<ReminderView> {
  if (!isReminderKind(kind)) {
    throw AppError.notFound(`Không có loại nhắc nhở '${kind}'`);
  }

  const row = await upsertReminder(kind, DEFAULTS[kind], input);
  return toReminderView(row);
}
