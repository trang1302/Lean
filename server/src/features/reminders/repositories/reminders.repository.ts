import { prisma } from '../../../lib/db.js';
import { LOCAL_USER_ID } from '../../../shared/constants.js';

/**
 * Chỗ DUY NHẤT của feature này chạm Prisma. Service và controller không import
 * `prisma`; đổi tầng lưu trữ thì chỉ sửa file này.
 *
 * Khóa của `Reminder` là KÉP `@@unique([userId, kind])`, nên mọi truy vấn đơn
 * lẻ đi qua `userId_kind`, không bao giờ tìm bằng `kind` trần.
 */

export interface ReminderRecord {
  kind: string;
  timeOfDay: string;
  enabled: boolean;
  ntfyTopic: string | null;
}

/** Trường được phép ghi. `undefined` = giữ nguyên (Prisma bỏ qua). */
export interface ReminderWriteData {
  timeOfDay?: string;
  enabled?: boolean;
  ntfyTopic?: string | null;
}

const VIEW_FIELDS = {
  kind: true,
  timeOfDay: true,
  enabled: true,
  ntfyTopic: true,
} as const;

export async function findAllReminders(): Promise<ReminderRecord[]> {
  return prisma.reminder.findMany({
    where: { userId: LOCAL_USER_ID },
    select: VIEW_FIELDS,
    orderBy: { kind: 'asc' },
  });
}

export async function findReminderByKind(kind: string): Promise<ReminderRecord | null> {
  return prisma.reminder.findUnique({
    where: { userId_kind: { userId: LOCAL_USER_ID, kind } },
    select: VIEW_FIELDS,
  });
}

/**
 * Upsert vì bản ghi có thể chưa tồn tại: `GET /reminders` trả cấu hình mặc
 * định cho loại chưa từng được lưu, nên lần `PUT` đầu tiên phải tạo được hàng.
 * `defaults` là giá trị dùng khi tạo mới, `data` là phần người dùng gửi lên.
 */
export async function upsertReminder(
  kind: string,
  defaults: Required<Pick<ReminderRecord, 'timeOfDay' | 'enabled' | 'ntfyTopic'>>,
  data: ReminderWriteData,
): Promise<ReminderRecord> {
  return prisma.reminder.upsert({
    where: { userId_kind: { userId: LOCAL_USER_ID, kind } },
    create: {
      userId: LOCAL_USER_ID,
      kind,
      timeOfDay: data.timeOfDay ?? defaults.timeOfDay,
      enabled: data.enabled ?? defaults.enabled,
      ntfyTopic: data.ntfyTopic === undefined ? defaults.ntfyTopic : data.ntfyTopic,
    },
    update: data,
    select: VIEW_FIELDS,
  });
}

/** Hôm nay đã có số đo cân nặng chưa? `BodyLog` tồn tại nhưng `weightKg` null thì chưa. */
export async function hasWeightLoggedOn(date: string): Promise<boolean> {
  const count = await prisma.bodyLog.count({
    where: { userId: LOCAL_USER_ID, date, weightKg: { not: null } },
  });
  return count > 0;
}

/** Hôm nay đã ghi bữa ăn nào chưa? */
export async function hasMealLoggedOn(date: string): Promise<boolean> {
  const count = await prisma.meal.count({ where: { userId: LOCAL_USER_ID, date } });
  return count > 0;
}
