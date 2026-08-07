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

/** Bản ghi thô từ Prisma — chỉ những trường view cần. */
interface ReminderRow {
  kind: string;
  timeOfDay: string;
  enabled: boolean;
  ntfyTopic: string | null;
}

export function toReminderView(row: ReminderRow): ReminderView {
  return {
    kind: row.kind,
    timeOfDay: row.timeOfDay,
    enabled: row.enabled,
    ntfyTopic: row.ntfyTopic,
  };
}
