import { prisma } from '../../../lib/db.js';

/**
 * Chỗ DUY NHẤT của feature này chạm Prisma. Service và controller không import
 * `prisma`; đổi tầng lưu trữ thì chỉ sửa file này.
 *
 * Khóa của `Reminder` là KÉP `@@unique([userId, kind])`, nên mọi truy vấn đơn
 * lẻ đi qua `userId_kind`, không bao giờ tìm bằng `kind` trần — `kind` một mình
 * khớp hàng của MỌI người dùng.
 */

export interface ReminderRecord {
  kind: string;
  timeOfDay: string;
  enabled: boolean;
  ntfyTopic: string | null;
}

/** Bản ghi kèm chủ sở hữu — chỉ scheduler cần, xem `findRemindersForAllUsers`. */
export interface ReminderRecordWithUser extends ReminderRecord {
  userId: string;
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

export async function findAllReminders(userId: string): Promise<ReminderRecord[]> {
  return prisma.reminder.findMany({
    where: { userId },
    select: VIEW_FIELDS,
    orderBy: { kind: 'asc' },
  });
}

/**
 * Nhắc nhở ĐANG BẬT của MỌI người dùng, trong MỘT truy vấn.
 *
 * Dùng bởi scheduler — thứ chạy từ cron nên không có request, không có phiên,
 * không có `userId` nào để lọc. Không lặp N+1 qua từng user (auth/SPEC.md:487).
 *
 * Lọc sẵn `enabled: true` ở DB: `selectDueReminders` vẫn lọc lại lần nữa (nó là
 * hàm thuần và phải đúng độc lập), nhưng không có lý do gì kéo về những hàng
 * chắc chắn bị loại.
 */
export async function findRemindersForAllUsers(): Promise<ReminderRecordWithUser[]> {
  return prisma.reminder.findMany({
    where: { enabled: true },
    select: { ...VIEW_FIELDS, userId: true },
    orderBy: [{ userId: 'asc' }, { kind: 'asc' }],
  });
}

export async function findReminderByKind(
  userId: string,
  kind: string,
): Promise<ReminderRecord | null> {
  return prisma.reminder.findUnique({
    where: { userId_kind: { userId, kind } },
    select: VIEW_FIELDS,
  });
}

/**
 * Upsert vì bản ghi có thể chưa tồn tại: `GET /reminders` trả cấu hình mặc
 * định cho loại chưa từng được lưu, nên lần `PUT` đầu tiên phải tạo được hàng.
 * `defaults` là giá trị dùng khi tạo mới, `data` là phần người dùng gửi lên.
 */
export async function upsertReminder(
  userId: string,
  kind: string,
  defaults: Required<Pick<ReminderRecord, 'timeOfDay' | 'enabled' | 'ntfyTopic'>>,
  data: ReminderWriteData,
): Promise<ReminderRecord> {
  return prisma.reminder.upsert({
    where: { userId_kind: { userId, kind } },
    create: {
      userId,
      kind,
      timeOfDay: data.timeOfDay ?? defaults.timeOfDay,
      enabled: data.enabled ?? defaults.enabled,
      ntfyTopic: data.ntfyTopic === undefined ? defaults.ntfyTopic : data.ntfyTopic,
    },
    update: data,
    select: VIEW_FIELDS,
  });
}

/**
 * Hôm nay đã có số đo cân nặng chưa? `BodyLog` tồn tại nhưng `weightKg` null thì chưa.
 *
 * `userId` trong `where` là bắt buộc: thiếu nó, scheduler thấy "đã có NGƯỜI NÀO ĐÓ
 * ghi cân" rồi im lặng với TẤT CẢ mọi người.
 */
export async function hasWeightLoggedOn(userId: string, date: string): Promise<boolean> {
  const count = await prisma.bodyLog.count({
    where: { userId, date, weightKg: { not: null } },
  });
  return count > 0;
}

/** Hôm nay đã ghi bữa ăn nào chưa? Cùng lý do về `userId` như hàm trên. */
export async function hasMealLoggedOn(userId: string, date: string): Promise<boolean> {
  const count = await prisma.meal.count({ where: { userId, date } });
  return count > 0;
}
