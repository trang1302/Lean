/**
 * Hình dạng một cấu hình nhắc nhở khi ra khỏi server.
 *
 * `id`, `userId`, `updatedAt` cố tình không lộ ra: client chỉ định danh nhắc
 * nhở bằng `kind` (đó là khóa nghiệp vụ), phần còn lại là chi tiết lưu trữ.
 */
export interface ReminderView {
  kind: string;
  /** "HH:mm" 24 giờ, giờ địa phương Asia/Ho_Chi_Minh. */
  timeOfDay: string;
  enabled: boolean;
  ntfyTopic: string | null;
}

/**
 * Cùng dữ liệu, kèm chủ sở hữu — dùng NỘI BỘ bởi scheduler.
 *
 * Cố ý tách khỏi `ReminderView` thay vì thêm `userId` vào đó: `ReminderView` là
 * body của `GET /api/reminders`, thêm `userId` vào là lộ id người dùng ra API.
 * Vô hại (người gọi chỉ thấy id của chính mình) nhưng không có ai cần, và một
 * trường thừa trong response là thứ về sau có người bắt đầu dựa vào.
 *
 * Scheduler thì BẮT BUỘC cần `userId`: nó chạy từ cron, không có phiên, và
 * phải biết mỗi hàng là của ai để hỏi đúng người đã ghi cân chưa và gửi tới
 * đúng topic — gửi nhầm là rò dữ liệu sức khỏe sang người lạ.
 */
export interface ReminderRow extends ReminderView {
  userId: string;
}

/** Bản ghi thô từ Prisma — chỉ những trường view cần. */
interface ReminderRowInput {
  kind: string;
  timeOfDay: string;
  enabled: boolean;
  ntfyTopic: string | null;
}

export function toReminderView(row: ReminderRowInput): ReminderView {
  return {
    kind: row.kind,
    timeOfDay: row.timeOfDay,
    enabled: row.enabled,
    ntfyTopic: row.ntfyTopic,
  };
}

export function toReminderRow(row: ReminderRowInput & { userId: string }): ReminderRow {
  return { userId: row.userId, ...toReminderView(row) };
}
