# Feature `reminders` — Đặc tả theo code thật

Tài liệu này mô tả **hành vi của code đang chạy**, không phải ý định ban đầu. Mọi
khẳng định đều dẫn `đường-dẫn:dòng`. Chỗ nào code lệch spec gốc
(`docs/archive/2026-08-06-original-design.md`) đều được ghi rõ.

## 1. Feature này làm gì

Hai việc, tách hẳn nhau:

1. **Cấu hình** — API đọc/ghi cấu hình nhắc nhở (giờ, bật/tắt, topic ntfy).
   `server/src/features/reminders/controllers/reminders.controller.ts`
2. **Scheduler** — cron trong tiến trình server, mỗi phút quét xem có nhắc nhở
   nào đến giờ thì gửi qua ntfy.
   `server/src/features/reminders/services/reminders.scheduler.ts`

Router cắm ở prefix `/api/reminders` (`server/src/app.ts:25`); path bên trong
controller là tương đối (`server/src/features/reminders/index.ts:4-7`).

## 2. Tập `kind` là ĐÓNG

```ts
export const REMINDER_KINDS = ['weigh_in', 'meal_log'] as const;
```
`server/src/features/reminders/dtos/reminders.request.ts:8`

Người dùng **không tự thêm loại nhắc nhở**. `PUT /reminders/:kind` với `kind`
ngoài tập này trả `404` và **không ghi gì vào DB** — kiểm tra `isReminderKind`
chạy TRƯỚC khi chạm repository
(`server/src/features/reminders/services/reminders.service.ts:58-62`). Test canh
đúng điều đó: sau khi nhận 404, `prisma.reminder.count()` vẫn là `0`
(`server/test/features/reminders/reminders.controller.test.ts:136-142`).

Muốn thêm loại mới thì phải sửa `REMINDER_KINDS`, thêm mặc định trong `DEFAULTS`
(`reminders.service.ts:22-25`), thêm nội dung trong `NOTIFICATIONS`
(`reminders.scheduler.ts:49-60`) và thêm nhánh trong `needsReminder`
(`reminders.scheduler.ts:102-110`). Thiếu một trong bốn chỗ đó thì loại mới im
lặng không gửi.

## 3. Endpoint

| Method | Route | Body | 200 trả về | Lỗi |
|---|---|---|---|---|
| `GET` | `/api/reminders` | — | Mảng `ReminderView[]`, luôn đủ mọi `kind`, thứ tự theo `REMINDER_KINDS` | — |
| `PUT` | `/api/reminders/:kind` | `{ timeOfDay?, enabled?, ntfyTopic? }` (`.strict()`) | Một `ReminderView` sau khi cập nhật | `400` validate, `404` `kind` lạ |

`ReminderView` (`server/src/features/reminders/dtos/reminders.response.ts:7-13`):

```jsonc
{
  "kind": "weigh_in",
  "timeOfDay": "07:00",   // "HH:mm" 24 giờ, giờ Asia/Ho_Chi_Minh
  "enabled": false,
  "ntfyTopic": null
}
```

Hình dạng lỗi do `errorHandler` quyết định
(`server/src/shared/errors/errorHandler.ts:32-52`):

- `400` → `{ error: { code: 'VALIDATION_ERROR', message, fields: [{ path, message }] } }`
- `404` → `{ error: { code: 'NOT_FOUND', message } }`

### Ràng buộc body `PUT`

| Trường | Ràng buộc | Nguồn |
|---|---|---|
| `timeOfDay` | `^([01]\d\|2[0-3]):[0-5]\d$` | `server/src/shared/validation/commonSchemas.ts:31-33` |
| `enabled` | boolean | `reminders.request.ts:35` |
| `ntfyTopic` | trim, dài 1–64, chỉ `[A-Za-z0-9_-]`, hoặc `null` | `reminders.request.ts:20-26` |
| trường lạ | `.strict()` → 400 | `reminders.request.ts:38` |

Quy ước partial giống `PUT /body-logs/:date`: **trường vắng mặt giữ nguyên giá
trị cũ, gửi `null` mới là lệnh xóa** (`reminders.service.ts:47-49`, hiện thực ở
`repositories/reminders.repository.ts:65,67`). Test:
`reminders.controller.test.ts:109-134`.

## 4. `GET` không bao giờ ghi DB

`listReminders` đọc mọi hàng của người dùng cục bộ, dựng `Map` theo `kind`, rồi
**trộn hàng DB lên trên giá trị mặc định hard-code**
(`reminders.service.ts:37-45`). Loại chưa từng được cấu hình đơn giản là hiện
mặc định — **không seed hàng vào DB trong một request GET**
(`reminders.service.ts:33-36`).

Giá trị mặc định thật (`reminders.service.ts:22-25`):

| `kind` | `timeOfDay` | `enabled` | `ntfyTopic` |
|---|---|---|---|
| `weigh_in` | `07:00` | `false` | `null` |
| `meal_log` | `20:00` | `false` | `null` |

`enabled: false` + `ntfyTopic: null` là chủ ý: không tự bật thông báo cho người
chưa hề cấu hình topic. Giờ mặc định chỉ là gợi ý điền sẵn trên trang Cài đặt.

Hệ quả cần nhớ: **DB rỗng thì `GET /api/reminders` vẫn trả mảng 2 phần tử**, và
mảng đó vẫn đủ 2 phần tử ngay cả khi trong DB chỉ có hàng của `userId` khác
(`reminders.controller.test.ts:20-32,56-74`).

## 5. Khóa DB là `@@unique([userId, kind])`

```prisma
model Reminder {
  id String @id @default(cuid())
  userId String
  kind String
  ...
  @@unique([userId, kind])
}
```
`server/prisma/schema.prisma:59-70`

Khóa là **kép**, không phải `kind` đơn. Mọi truy vấn đơn lẻ đi qua
`where: { userId_kind: { userId, kind } }` — không bao giờ tìm bằng `kind` trần, vì `kind` một
mình khớp hàng của **mọi** người dùng.

Scheduler là ngoại lệ có chủ đích: nó chạy từ cron nên không có phiên, và dùng
`findRemindersForAllUsers()` — một truy vấn lấy nhắc nhở đang bật của mọi user, mỗi hàng mang
`userId` để gửi đúng topic. Gửi nhầm topic ở đây là rò dữ liệu sức khỏe sang người lạ, nên có
suite riêng canh: `test/features/reminders/scheduler.multiUser.test.ts`.

Repository là chỗ **duy nhất** của feature chạm Prisma; service và controller
không import `prisma` (`reminders.repository.ts:4-10`).

`PUT` dùng `upsert` vì hàng có thể chưa tồn tại — `GET` trả mặc định cho loại
chưa lưu, nên lần `PUT` đầu tiên phải tạo được hàng
(`reminders.repository.ts:48-70`). Gọi `PUT` hai lần chỉ sinh một hàng
(`reminders.controller.test.ts:98-107`).

## 6. Scheduler — phần quan trọng nhất

File: `server/src/features/reminders/services/reminders.scheduler.ts`

### 6.1 Hàm thuần tách khỏi cron

`selectDueReminders(reminders, now)` (`reminders.scheduler.ts:84-95`) là **hàm
thuần**: nhận danh sách nhắc nhở và mốc thời gian, trả về những cái đến hạn.
Không đọc DB, không gửi gì, không sửa mảng đầu vào.

Điểm mấu chốt: **`now` là tham số, không gọi `new Date()` bên trong**. Nhờ vậy
test kiểm được "đến giờ nào gửi cái gì" mà không phải chờ đồng hồ và không gọi
mạng (`reminders.scheduler.test.ts:51-89`, kể cả test canh bất biến của mảng đầu
vào ở dòng 83-88).

Điều kiện đến hạn (cả ba phải đúng, `reminders.scheduler.ts:89-94`):
`enabled === true` **và** `timeOfDay` khớp phút hiện tại **và** `ntfyTopic` sau
trim khác rỗng.

Phụ trợ cùng hướng: `runDueReminders(now, deps)`
(`reminders.scheduler.ts:118-148`) nhận toàn bộ tác dụng phụ qua
`ReminderRunnerDeps` (`reminders.scheduler.ts:35-47`) — `listReminders`,
`hasWeightLogged`, `hasMealLogged`, `send`. Test dựng nguyên một lượt quét bằng
hàm giả, không cần DB thật lẫn mạng (`reminders.scheduler.test.ts:29-37`).

`runDueReminders` **không ném lỗi ra ngoài**; lỗi gửi hiện dưới dạng
`{ kind, status: 'send-failed' }` thay vì im lặng
(`reminders.scheduler.ts:112-117,144`). `status` có ba giá trị: `'sent'`,
`'already-logged'`, `'send-failed'` (`reminders.scheduler.ts:24`).

### 6.2 Import module KHÔNG tự khởi động cron

`reminders.scheduler.ts` chỉ **export** `startReminderScheduler`
(`reminders.scheduler.ts:157-174`); import module không có tác dụng phụ.
`index.ts` re-export chứ không gọi (`reminders/index.ts:9-11`).

Chỗ duy nhất gọi start là `server.ts`, **sau khi `listen()` thành công**
(`server/src/server.ts:14-18`). `app.ts` chỉ lắp app, không listen — để supertest
dựng app trong test mà không chiếm cổng.

Vì sao bắt buộc như vậy: nếu import mà cron tự chạy thì **mọi file test import
feature này sẽ bật một cron thật, dính đồng hồ hệ thống**, sinh test chập chờn và
treo tiến trình vitest. Giữ nguyên ranh giới này.

`startReminderScheduler` là idempotent — gọi lần hai trả lại task cũ
(`reminders.scheduler.ts:158`). `stopReminderScheduler` được gọi ở SIGINT/SIGTERM
(`server.ts:20-27`).

### 6.3 `hourCycle: 'h23'`, KHÔNG phải `hour12: false`

```ts
new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(now);
```
`reminders.scheduler.ts:68-75`

`hour12: false` cho Intl chọn chu kỳ `h24`, và `h24` in **nửa đêm thành `"24:05"`**
thay vì `"00:05"`. `"24:05"` không bao giờ khớp `timeOfDay` nào đã lưu — schema
chỉ cho `00:00`–`23:59` (`commonSchemas.ts:31-33`). Kết quả là nhắc nhở đặt trong
giờ 00 sẽ **im lặng không bao giờ chạy**.

Đây là loại bug xuất hiện đúng một lần mỗi ngày và chỉ với vài phút cấu hình cụ
thể — cực khó truy. Có test canh riêng: `17:05Z` phải ra `"00:05"`
(`reminders.scheduler.test.ts:44-48`). **Đừng đổi `hourCycle` thành `hour12`.**

Múi giờ lấy từ `TZ = 'Asia/Ho_Chi_Minh'` (`server/src/lib/time.ts:1`), đúng quy
ước ngày tháng của dự án.

### 6.4 Chỉ chạy khi server bật, KHÔNG gửi bù

Cron chạy đầu mỗi phút: `'0 * * * * *'` (`reminders.scheduler.ts:22`) — độ phân
giải của `timeOfDay` là phút, không cần dày hơn.

**Máy tắt lúc 07:00 thì nhắc nhở 07:00 hôm đó mất luôn.** Không có hàng đợi,
không có cơ chế đuổi kịp, không gửi bù khi bật lại. Đây là hành vi **có chủ đích**
theo spec §8 (`docs/archive/2026-08-06-original-design.md:320`), được ghi lại ngay đầu file
scheduler (`reminders.scheduler.ts:15-19`) và in ra console khi khởi động
(`server.ts:17`).

**Người sau đừng tự thêm cơ chế gửi bù.** Nhắc nhở đã trễ vài giờ thì vô ích, và
một hàng đợi gửi bù sẽ bắn cả loạt thông báo cũ mỗi lần mở máy.

**Giao diện Cài đặt BẮT BUỘC phải nói điều này với người dùng** — spec §7 đã ghi
"Ghi rõ ngay trên giao diện: nhắc nhở chỉ hoạt động khi server đang chạy"
(`docs/archive/2026-08-06-original-design.md:305`). Không có dòng đó, người dùng sẽ tin là
mình được nhắc và bỏ ghi dữ liệu.

### 6.5 Điều kiện gửi có xét dữ liệu đã ghi hay chưa

Nhắc nhở có điều kiện: đã ghi rồi thì không làm phiền
(`reminders.scheduler.ts:97-110`).

| `kind` | Gửi khi | Cách kiểm tra |
|---|---|---|
| `weigh_in` | Hôm nay **chưa** có `BodyLog` với `weightKg` khác `null` | `hasWeightLoggedOn` — `count` với `weightKg: { not: null }` (`reminders.repository.ts:72-78`) |
| `meal_log` | Hôm nay **chưa** có `Meal` nào | `hasMealLoggedOn` — `count` theo `date` (`reminders.repository.ts:80-84`) |
| khác | **không bao giờ gửi** | `needsReminder` trả `false` ở nhánh mặc định (`reminders.scheduler.ts:109`) |

Chi tiết dễ bỏ sót: **hàng `BodyLog` chỉ có `waistCm` mà `weightKg` là `null` vẫn
tính là CHƯA cân** — điều kiện `weightKg: { not: null }` loại đúng trường hợp đó
(`reminders.repository.ts:75`). Ghi số đo vòng bụng không làm tắt nhắc cân.

"Hôm nay" là `todayIso()` theo `Asia/Ho_Chi_Minh` (`reminders.scheduler.ts:125`,
`server/src/lib/time.ts:7-10`) — không dùng `new Date()` trần.

Nhánh `kind` lạ trả `false` (không gửi) chứ không phải `true`: gặp dữ liệu cũ
trong DB mà không biết cách kiểm tra thì im lặng an toàn hơn là spam.

Nhắc nhở `enabled: false` không chỉ không gửi mà **còn không hỏi DB** — nó bị
loại từ `selectDueReminders` trước khi tới `needsReminder`
(`reminders.scheduler.test.ts:142-152`).

### 6.6 node-cron v4

`cron.schedule(expression, fn, options)` trả `ScheduledTask` và **tự chạy ngay** —
v4 không còn cờ `scheduled: false` như v3 (`reminders.scheduler.ts:152-171`).
Options đang dùng: `{ timezone: TZ, name: 'lean-reminders', noOverlap: true }`.
`noOverlap` chặn lượt quét mới khi lượt trước còn đang chạy. Chi tiết chữ ký v4
xem `PLAN.md` §4.

Callback được bọc `try/catch` với `console.error`: lỗi ngoài dự kiến trong một
lượt quét **không được phép hạ tiến trình server**
(`reminders.scheduler.ts:162-169`).

## 7. ntfy client

File: `server/src/shared/clients/ntfy.client.ts`

Dùng chung (nằm ở `shared/clients/`) chứ không thuộc riêng feature reminders.

- **Nuốt lỗi mạng, KHÔNG BAO GIỜ ném ra ngoài.** Hàm này chạy trong cron; một lần
  mất mạng mà làm sập tiến trình thì mọi nhắc nhở sau đó mất theo. Mọi hỏng hóc
  được `console.error` rồi trả `{ sent: false, reason }` để chỗ gọi tự xử
  (`ntfy.client.ts:33-39,59-69`). Kiểu trả về là union tường minh:
  `no-topic` | `network-error` | `http-error` + `status`
  (`ntfy.client.ts:11-15`). Test: `reminders.scheduler.test.ts:220-234`.
- **Có timeout 5 giây** qua `AbortSignal.timeout(REQUEST_TIMEOUT_MS)`
  (`ntfy.client.ts:18,56`). Nhắc nhở trễ thì vô ích, và cron phút sau lại chạy.
  `AbortError` rơi vào cùng nhánh `network-error`.
- **Không gọi mạng khi topic rỗng.** `topic.trim() === ''` trả ngay
  `{ sent: false, reason: 'no-topic' }` trước cả khi dựng URL
  (`ntfy.client.ts:41-42`). Test canh `fetch` không hề được gọi
  (`reminders.scheduler.test.ts:236-243`).
- **Tiêu đề tiếng Việt mã hóa RFC 2047.** Header HTTP chỉ mang được ASCII, nên
  giá trị ngoài ASCII được bọc thành `=?UTF-8?B?<base64>?=` — ntfy giải mã lại
  (`ntfy.client.ts:23-31`). Nhét thẳng `"Lean — nhắc cân"` vào header sẽ ra tiêu
  đề rác hoặc bị `fetch` từ chối. Áp cho cả `X-Title` và `X-Tags`
  (`ntfy.client.ts:47,49`). Test khẳng định header thuần ASCII và chứa
  `=?UTF-8?B?` (`reminders.scheduler.test.ts:207-218`).

URL đích: `${NTFY_BASE_URL}/${encodeURIComponent(topic)}`, đã cắt dấu `/` thừa ở
đuôi base (`ntfy.client.ts:44`). `NTFY_BASE_URL` mặc định `https://ntfy.sh`
(`server/src/config/env.ts:6`). Body là `message.message` với
`Content-Type: text/plain; charset=utf-8` (`ntfy.client.ts:46,55`).

Nội dung thông báo cố định theo `kind` (`reminders.scheduler.ts:49-60`):

| `kind` | `title` | `tags` |
|---|---|---|
| `weigh_in` | `Lean — nhắc cân` | `scales` |
| `meal_log` | `Lean — nhắc ghi bữa ăn` | `fork_and_knife` |

## 8. Quyết định vượt spec

Những điểm code chặt hơn hoặc cụ thể hơn spec gốc. Mỗi cái kèm lý do — đừng gỡ
mà không hiểu lý do.

1. **`ntfyTopic` có ràng buộc định dạng** — trim, 1–64 ký tự, chỉ
   `[A-Za-z0-9_-]` (`reminders.request.ts:20-26`). Spec §5 không nói gì về
   `ntfyTopic`. *Vì sao:* topic đi thẳng vào path URL của ntfy; ký tự khoảng
   trắng hay `/` sẽ đẻ ra URL sai hoặc topic ngoài ý muốn. Chặn ở biên rẻ hơn là
   debug một thông báo không bao giờ tới.

2. **Body `PUT` là `.strict()`** — gõ sai tên trường (`timeOfDayy`) trả `400` chứ
   không im lặng bỏ qua (`reminders.request.ts:32-38`, test
   `reminders.controller.test.ts:173-178`). *Vì sao:* schema partial mà lỏng thì
   một lỗi chính tả sẽ cho ra response `200` với dữ liệu không hề đổi — người
   dùng chỉ thấy "đặt giờ xong mà nhắc nhở vẫn giờ cũ" và không có manh mối nào.

3. **Response là mảng trần, không bọc `{ data: ... }`** (`GET` trả thẳng
   `ReminderView[]`, `reminders.controller.ts:13-15`). *Vì sao:* nhất quán với
   các endpoint khác của dự án; client chỉ cần map thẳng.

4. **Không lộ `id`, `userId`, `updatedAt`** (`reminders.response.ts:1-13`,
   `VIEW_FIELDS` ở `reminders.repository.ts:26-31`). *Vì sao:* client định danh
   nhắc nhở bằng `kind` — đó là khóa nghiệp vụ. `id` là cuid nội bộ, `userId` là
   hằng cho tới khi có auth, `updatedAt` không ai dùng. Lộ ra là mời người sau
   viết code phụ thuộc vào chi tiết lưu trữ.

5. **`enabled: true` mà thiếu topic bị bỏ qua IM LẶNG.** API vẫn nhận
   `{ enabled: true }` khi `ntfyTopic` là `null` và trả `200`; scheduler thì lọc
   nó ra ở `selectDueReminders` (`reminders.scheduler.ts:93`), test ở
   `reminders.scheduler.test.ts:67-73`. *Vì sao:* không thể gửi thông báo tới
   topic rỗng, và ném `400` ở API sẽ chặn thao tác hợp lý "bật trước, điền topic
   sau" trên trang Cài đặt. **Hệ quả cần xử ở UI:** trang Cài đặt nên cảnh báo
   khi `enabled === true` mà `ntfyTopic` rỗng, nếu không người dùng sẽ tưởng
   nhắc nhở đang hoạt động.

6. **`runDueReminders` trả `ReminderRunOutcome[]`** thay vì `void`
   (`reminders.scheduler.ts:24-29`). *Vì sao:* để test khẳng định được
   `'already-logged'` khác `'send-failed'` khác "không đến giờ" mà không phải
   soi log.

7. **`needsReminder` với `kind` lạ trả `false`** (`reminders.scheduler.ts:109`).
   *Vì sao:* xem §6.5.

## 9. Chỗ code lệch spec gốc

- **Spec §8 nói port `ntfy.ts` từ `Todo/`**; code đặt nó ở
  `server/src/shared/clients/ntfy.client.ts` theo cấu trúc feature-based của
  server hiện tại. Hành vi (encode tiêu đề UTF-8) giữ nguyên tinh thần spec.
- **Spec §7 mô tả nút "Gửi thử"** trên trang Cài đặt
  (`docs/archive/2026-08-06-original-design.md:304`) nhưng **§5 không có route nào tương ứng**
  và code cũng chưa có. Xem `PLAN.md` §5 — đây là lỗ hổng spec cần chốt trước khi
  làm web.
- **Spec §8 nói "ghi hạn chế trong README"**; code hiện thông báo đó ở console lúc
  khởi động (`server.ts:17`) và tài liệu này. README chưa có.
