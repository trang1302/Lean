import cron, { type ScheduledTask } from 'node-cron';
import { TZ, todayIso } from '../../../lib/time.js';
import {
  sendNtfyNotification,
  type NtfyMessage,
  type NtfySendResult,
} from '../../../shared/clients/ntfy.client.js';
import { toReminderRow, type ReminderRow, type ReminderView } from '../dtos/reminders.response.js';
import {
  findRemindersForAllUsers,
  hasMealLoggedOn,
  hasWeightLoggedOn,
} from '../repositories/reminders.repository.js';

/**
 * Nhắc nhở CHỈ chạy khi server đang bật và KHÔNG gửi bù (spec §8).
 * Máy tắt lúc 07:00 thì nhắc nhở 07:00 hôm đó mất luôn — đó là hành vi có chủ
 * đích, đừng thêm hàng đợi hay cơ chế đuổi kịp.
 */

/** Chạy đầu mỗi phút. Độ phân giải của `timeOfDay` là phút, không cần dày hơn. */
const EVERY_MINUTE = '0 * * * * *';

export type ReminderRunStatus = 'sent' | 'already-logged' | 'send-failed';

export interface ReminderRunOutcome {
  /** Ai — có nhiều người dùng thì log thiếu cái này là không lần ra được gì. */
  userId: string;
  kind: string;
  status: ReminderRunStatus;
}

/**
 * Mọi thứ chạm thế giới bên ngoài (DB, mạng) đi qua đây. Nhờ vậy test dựng
 * được cả một lượt quét mà không cần DB thật lẫn kết nối mạng.
 */
export interface ReminderRunnerDeps {
  /**
   * Nhắc nhở của MỌI người dùng. Scheduler chạy từ cron nên không có phiên,
   * không có ai để lọc theo — nó quét toàn bộ rồi tự phân nhánh theo `userId`
   * của từng hàng.
   */
  listReminders(): Promise<ReminderRow[]>;
  hasWeightLogged(userId: string, date: string): Promise<boolean>;
  hasMealLogged(userId: string, date: string): Promise<boolean>;
  send(message: NtfyMessage): Promise<NtfySendResult>;
}

export const defaultReminderRunnerDeps: ReminderRunnerDeps = {
  // KHÔNG dùng `remindersService.listReminders` — hàm đó nhận một `userId` và
  // trả về view đã bù giá trị mặc định cho loại chưa cấu hình. Scheduler cần
  // đúng những hàng CÓ THẬT trong DB, của mọi người, kèm chủ sở hữu.
  listReminders: async () => (await findRemindersForAllUsers()).map(toReminderRow),
  hasWeightLogged: hasWeightLoggedOn,
  hasMealLogged: hasMealLoggedOn,
  send: sendNtfyNotification,
};

const NOTIFICATIONS: Record<string, { title: string; message: string; tags: string[] }> = {
  weigh_in: {
    title: 'Lean — nhắc cân',
    message: 'Hôm nay bạn chưa ghi cân nặng. Cân rồi ghi lại một dòng thôi.',
    tags: ['scales'],
  },
  meal_log: {
    title: 'Lean — nhắc ghi bữa ăn',
    message: 'Hôm nay bạn chưa ghi bữa ăn nào.',
    tags: ['fork_and_knife'],
  },
};

/**
 * "HH:mm" của `now` theo Asia/Ho_Chi_Minh.
 *
 * `hourCycle: 'h23'` là bắt buộc: mặc định `hour12: false` của Intl có thể ra
 * "24:05" cho lúc nửa đêm, và "24:05" không bao giờ khớp `timeOfDay` nào.
 */
export function localTimeOfDay(now: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
}

/**
 * Hàm thuần: nhắc nhở nào đến giờ tại thời điểm `now`.
 *
 * Nhận `now` làm tham số chứ không gọi `new Date()` bên trong — đó là thứ làm
 * cho logic "đến giờ nào gửi cái gì" test được mà không phải chờ đồng hồ.
 * Không đọc DB, không gửi gì, không sửa mảng đầu vào.
 */
export function selectDueReminders<T extends ReminderView>(
  reminders: readonly T[],
  now: Date,
): T[] {
  const currentTime = localTimeOfDay(now);
  return reminders.filter(
    (reminder) =>
      reminder.enabled &&
      reminder.timeOfDay === currentTime &&
      (reminder.ntfyTopic ?? '').trim() !== '',
  );
}

/**
 * Nhắc nhở có điều kiện (spec §8): đã ghi rồi thì không làm phiền.
 * Loại lạ (dữ liệu cũ trong DB chẳng hạn) coi như luôn cần nhắc là sai hướng —
 * không biết cách kiểm tra thì không gửi.
 */
async function needsReminder(
  userId: string,
  kind: string,
  date: string,
  deps: ReminderRunnerDeps,
): Promise<boolean> {
  if (kind === 'weigh_in') return !(await deps.hasWeightLogged(userId, date));
  if (kind === 'meal_log') return !(await deps.hasMealLogged(userId, date));
  return false;
}

/**
 * Một lượt quét: chọn nhắc nhở đến giờ, kiểm tra điều kiện, gửi.
 *
 * Không ném lỗi ra ngoài — lỗi gửi trả về dưới dạng `status: 'send-failed'`.
 * Cron nuốt lỗi lặng lẽ thì lần sau không ai biết vì sao im.
 */
export async function runDueReminders(
  now: Date,
  deps: ReminderRunnerDeps = defaultReminderRunnerDeps,
): Promise<ReminderRunOutcome[]> {
  const due = selectDueReminders(await deps.listReminders(), now);
  if (due.length === 0) return [];

  const date = todayIso();
  const outcomes: ReminderRunOutcome[] = [];

  for (const reminder of due) {
    // `reminder.userId`, KHÔNG phải một userId nào lấy sẵn ngoài vòng lặp:
    // mỗi hàng thuộc một người khác nhau. Hỏi nhầm người là gửi nhắc cho người
    // đã ghi cân và im lặng với người chưa ghi.
    if (!(await needsReminder(reminder.userId, reminder.kind, date, deps))) {
      outcomes.push({ userId: reminder.userId, kind: reminder.kind, status: 'already-logged' });
      continue;
    }

    const notification = NOTIFICATIONS[reminder.kind];
    if (!notification) continue;

    const result = await deps.send({
      topic: (reminder.ntfyTopic ?? '').trim(),
      title: notification.title,
      message: notification.message,
      tags: notification.tags,
    });

    outcomes.push({
      userId: reminder.userId,
      kind: reminder.kind,
      status: result.sent ? 'sent' : 'send-failed',
    });
  }

  return outcomes;
}

let task: ScheduledTask | null = null;

/**
 * node-cron v4: `schedule(expression, fn, options)` trả `ScheduledTask` và
 * TỰ CHẠY ngay — không có cờ `scheduled: false` như v3, dừng thì gọi `stop()`.
 * `timezone` vẫn nằm trong `options`.
 */
export function startReminderScheduler(): ScheduledTask {
  if (task) return task;

  task = cron.schedule(
    EVERY_MINUTE,
    async () => {
      // Lỗi ngoài dự kiến ở đây không được phép hạ tiến trình server.
      try {
        await runDueReminders(new Date());
      } catch (error) {
        console.error('[reminders] lượt quét thất bại:', error);
      }
    },
    { timezone: TZ, name: 'lean-reminders', noOverlap: true },
  );

  return task;
}

export async function stopReminderScheduler(): Promise<void> {
  if (!task) return;
  await task.stop();
  task = null;
}
