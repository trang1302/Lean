# Feature `reminders` — Kế hoạch & trạng thái

## 1. Trạng thái: ĐÃ XONG

37 test pass, chia hai file:

| File test | Số test | Nội dung |
|---|---|---|
| `server/test/features/reminders/reminders.controller.test.ts` | 17 | 3 test `GET /api/reminders`, 14 test `PUT /api/reminders/:kind` (trong đó `it.each` 6 ca `timeOfDay` sai định dạng) |
| `server/test/features/reminders/reminders.scheduler.test.ts` | 20 | 2 `localTimeOfDay`, 6 `selectDueReminders`, 7 `runDueReminders`, 5 `sendNtfyNotification` |

Không test nào chạm mạng và không test nào chờ đồng hồ:
`now` luôn là tham số, `fetch` luôn bị stub
(`reminders.scheduler.test.ts:11-14,180-183`).

## 2. File đã tạo

| File | Vai trò |
|---|---|
| `server/src/features/reminders/dtos/reminders.request.ts` | `REMINDER_KINDS` (tập đóng), `isReminderKind`, `updateReminderSchema` (`.strict()`), ràng buộc `ntfyTopic` |
| `server/src/features/reminders/dtos/reminders.response.ts` | `ReminderView` + `toReminderView` — cắt `id`/`userId`/`updatedAt` khỏi response |
| `server/src/features/reminders/repositories/reminders.repository.ts` | Chỗ duy nhất chạm Prisma: `findAllReminders`, `findReminderByKind`, `upsertReminder`, `hasWeightLoggedOn`, `hasMealLoggedOn` |
| `server/src/features/reminders/services/reminders.service.ts` | `DEFAULTS`, `listReminders` (trộn DB lên mặc định, không ghi), `updateReminder` (404 cho `kind` lạ) |
| `server/src/features/reminders/services/reminders.scheduler.ts` | `localTimeOfDay`, `selectDueReminders` (hàm thuần), `runDueReminders` (nhận deps), `startReminderScheduler` / `stopReminderScheduler` |
| `server/src/features/reminders/controllers/reminders.controller.ts` | Router: `GET /`, `PUT /:kind`. Không try/catch — Express 5 tự đẩy lỗi async sang `errorHandler` |
| `server/src/features/reminders/index.ts` | Export `remindersRouter` + re-export start/stop. **Không** khởi động cron khi import |
| `server/src/shared/clients/ntfy.client.ts` | Client ntfy dùng chung: timeout 5s, nuốt lỗi mạng, encode header RFC 2047, không gọi mạng khi topic rỗng |

Điểm cắm vào phần còn lại của app:

- `server/src/app.ts:25` — `app.use('/api/reminders', remindersRouter)`
- `server/src/server.ts:14-18` — `startReminderScheduler()` gọi **trong callback
  của `listen()`**, không phải lúc import
- `server/src/server.ts:20-27` — `stopReminderScheduler()` ở SIGINT/SIGTERM
- `server/prisma/schema.prisma:59-70` — model `Reminder`, khóa `@@unique([userId, kind])`

## 3. Lệnh verify

```bash
cd server

# Chỉ feature này
npx vitest run test/features/reminders

# Toàn bộ test
npm test          # = vitest run

# Kiểu — tsc, không phát sinh file
npm run typecheck # = tsc --noEmit
```

`npm run build` (`tsc -p tsconfig.json`) cũng phải sạch trước khi coi là xong.

## 4. Chữ ký API thật của `node-cron` v4

Phiên bản đang cài: **4.6.0** (`server/node_modules/node-cron/package.json`).
Trích từ `server/node_modules/node-cron/dist/node-cron.d.ts` — **đọc từ file,
không viết theo trí nhớ v3.**

```ts
declare function schedule(
  expression: string,
  func: TaskFn | string,
  options?: TaskOptions,
): ScheduledTask;

declare function createTask(
  expression: string,
  func: TaskFn | string,
  options?: TaskOptions,
): ScheduledTask;

type TaskFn = (context: TaskContext) => any | Promise<any>;

type TaskOptions = {
  timezone?: string;
  name?: string;
  noOverlap?: boolean;
  distributed?: boolean;
  runCoordinator?: RunCoordinator;
  distributedLease?: number;
  maxExecutions?: number;
  maxRandomDelay?: number;
  logger?: Logger;
  suppressMissedWarning?: boolean;
  missedExecutionTolerance?: number;
  executeTimeout?: number;
  startTimeout?: number;
  unref?: boolean;
};

interface ScheduledTask {
  id: string;
  name?: string;
  start(): void | Promise<void>;
  stop(): void | Promise<void>;
  getStatus(): string;
  destroy(): void | Promise<void>;
  execute(): Promise<any>;
  getNextRun(): Date | null;
  getNextRuns(count: number): Date[];
  match(date: Date): boolean;
  msToNext(): number | null;
  isBusy(): boolean;
  runsLeft(): number | undefined;
  getPattern(): string;
  lastRun(): LastRun | null;
  unref(): void;
  ref(): void;
  on(event: TaskEvent, fun: (ctx: TaskContext) => Promise<void> | void): void;
  off(event: TaskEvent, fun: (ctx: TaskContext) => Promise<void> | void): void;
  once(event: TaskEvent, fun: (ctx: TaskContext) => Promise<void> | void): void;
}

// Cấp module, không có ở v3:
declare function shutdown(timeout?: number): Promise<void>;
declare const getTasks: () => Map<string, ScheduledTask>;
declare const getTask: (taskId: string) => ScheduledTask | undefined;
declare function setLogger(logger: Logger): void;
declare function setRunCoordinator(coordinator: RunCoordinator | undefined): void;
```

### Khác biệt so với v3 — đọc kỹ trước khi sửa scheduler

| Điểm | v3 (trí nhớ phổ biến) | v4.6 (thật) |
|---|---|---|
| Tạo task không chạy ngay | `schedule(expr, fn, { scheduled: false })` | **Không còn `scheduled`** trong `TaskOptions`. Dùng `createTask(...)` rồi `start()` khi cần |
| `schedule()` | Có thể tạo ở trạng thái dừng | **Luôn tự chạy ngay** khi gọi |
| `stop()` | `void` | `void \| Promise<void>` — code hiện `await task.stop()` (`reminders.scheduler.ts:178`) |
| Chống chồng lượt | Tự lo | `noOverlap: true` trong options |
| Callback | `() => void` | `TaskFn` nhận `TaskContext` (có `date`, `dateLocalIso`, `task`, `execution`, `triggeredAt`) |
| Đặt tên task | Không có | `name` trong options; tra lại bằng `getTask(id)` / `getTasks()` |
| Tắt toàn cục | Không có | `cron.shutdown(timeout?)` trả `Promise` |
| `timezone` | Trong options | Không đổi — vẫn trong options |

Code hiện dùng đúng dạng v4:

```ts
task = cron.schedule(
  EVERY_MINUTE,                                     // '0 * * * * *'
  async () => { try { await runDueReminders(new Date()); } catch (e) { ... } },
  { timezone: TZ, name: 'lean-reminders', noOverlap: true },
);
```
`server/src/features/reminders/services/reminders.scheduler.ts:160-171`

## 5. Việc còn treo

### 5.1 Lỗ hổng spec: nút "Gửi thử" không có route

Spec §7 mô tả trang Cài đặt có **nút "Gửi thử"**
(`docs/archive/2026-08-06-original-design.md:304`), nhưng **§5 không liệt kê route nào tương
ứng** (`docs/archive/2026-08-06-original-design.md:177-195` chỉ có `GET /reminders` và
`PUT /reminders/:kind`). Code cũng không có — grep `test` trong
`server/src/features/reminders/` không ra endpoint nào.

Trang Cài đặt sẽ cần một thứ đại loại:

```
POST /api/reminders/:kind/test  →  200 { sent: boolean, reason?: string }
```

Cần chốt trước khi bắt tay làm web, ít nhất bốn điểm:

1. **Gửi với topic nào** — topic đã lưu trong DB, hay topic client đang gõ dở
   trong ô nhập và gửi kèm body? (Người dùng thường bấm "Gửi thử" *trước* khi
   bấm Lưu.)
2. **Có bỏ qua điều kiện `needsReminder` không?** Gửi thử phải gửi ngay cả khi
   hôm nay đã ghi cân — nếu không thì nút vô dụng với người dùng chăm chỉ.
3. **Có bỏ qua `enabled` không?** Gần như chắc chắn là có.
4. **Hình dạng response khi ntfy hỏng.** `sendNtfyNotification` không ném lỗi, nó
   trả `{ sent: false, reason }` (`server/src/shared/clients/ntfy.client.ts:11-15`);
   endpoint nên trả nguyên `reason` đó thay vì `500`, để UI hiện được "topic sai"
   khác với "không có mạng".

Phần khó nhất đã có sẵn: `sendNtfyNotification` và `NOTIFICATIONS`
(`reminders.scheduler.ts:49-60`) dùng lại được nguyên vẹn. Việc còn lại thuần là
chốt hợp đồng API.

### 5.2 Ghi hạn chế "không gửi bù" lên giao diện

Spec §7 (`docs/archive/2026-08-06-original-design.md:305`) và §8
(`docs/archive/2026-08-06-original-design.md:320`) đều yêu cầu nói rõ với người dùng rằng
nhắc nhở chỉ chạy khi server bật và **không có gửi bù**. Hiện mới có ở console lúc
khởi động (`server/src/server.ts:17`). **Trang Cài đặt bắt buộc phải hiển thị
dòng này** — thuộc phạm vi của feature web-settings.

### 5.3 Cảnh báo `enabled` mà thiếu topic

Xem `SPEC.md` §8 mục 5: API chấp nhận `enabled: true` khi `ntfyTopic` rỗng và trả
`200`, nhưng scheduler lọc bỏ im lặng. Trang Cài đặt nên cảnh báo tại chỗ, nếu
không người dùng tưởng nhắc nhở đang hoạt động.
