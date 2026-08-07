# Feature `web-settings` — Trang Cài đặt

Trang 3 của web (`docs/archive/2026-08-06-original-design.md:301-306`). **Chưa có dòng code
nào** — tài liệu này là hợp đồng để người sau implement, không phải mô tả code
đang chạy.

Ràng buộc cứng: backend đã xong và đã khóa hợp đồng API (208 test pass). Mọi
endpoint dưới đây truy được về `docs/features/goal/SPEC.md` và
`docs/features/reminders/SPEC.md`. **Không bịa thêm endpoint** — chỗ nào thiếu
route thì ghi là bị chặn (§7), không tự thêm.

## 1. Trang này để làm gì

Một trang, hai nhóm cài đặt, không có gì khác:

1. **Mục tiêu** — cân nặng đích, ngày đích, calo mục tiêu/ngày. Đây là dữ liệu
   nuôi thẻ tiến độ ở trang Biểu đồ và thanh tiến độ calo ở trang Hôm nay; cả hai
   trang đó chỉ *đọc*, chỗ *đặt* duy nhất là trang này.
2. **Nhắc nhở** — bật/tắt, giờ, ntfy topic cho hai loại `weigh_in` và `meal_log`.

Ngoài ra trang này gánh hai việc mà không trang nào khác làm được:

- **Nói ra hạn chế của kiến trúc nhắc nhở** (§5) — bắt buộc, xem `CLAUDE.md` mục
  "Cạm bẫy đã biết".
- **Dạy người dùng ntfy là gì** (§9) — nếu không, ô "topic" là một ô trống vô
  nghĩa và tính năng nhắc nhở coi như không dùng được.

Không thuộc phạm vi trang này: xóa dữ liệu, xuất/nhập, đổi timezone, thêm loại
nhắc nhở mới (tập `kind` là **đóng**, `reminders/SPEC.md` §2).

## 2. Vị trí và ranh giới

Theo `docs/overview/01-architecture.md`, web chia theo **trang**, không theo miền
dữ liệu:

```
web/src/features/settings/
├── api/settings.api.ts        # gọi HTTP, không biết React
├── components/SettingsPage.tsx + các component con
├── hooks/useSettings.ts       # state + loading/error, không biết fetch
└── index.ts                   # export SettingsPage
```

Stack: **React 19 + Vite 8**, `useState`/`useEffect` thuần. **Không** TanStack
Query, **không** Jotai, **không** shadcn (`01-architecture.md:13`). HTTP đi qua
`web/src/lib/apiClient.ts` dùng chung — file này **chưa tồn tại**, xem `PLAN.md`
§2.

Trang này gọi **hai** nhóm endpoint và không gọi gì khác. Đặc biệt: **không gọi
`GET /api/summary`**. Tiến độ mục tiêu (`remainingKg`, `onTrack`, `currentRate`)
thuộc trang Biểu đồ; nhân nó sang đây là nhân bản công thức
(`goal/SPEC.md` §7).

## 3. Nhóm 1 — Mục tiêu

Nguồn: `docs/features/goal/SPEC.md` §2, §6, §8.

### `GET /api/goal`

Không tham số. **Luôn trả 200**, kể cả khi chưa đặt mục tiêu lần nào:

```jsonc
{
  "targetWeightKg": 68,           // number | null
  "targetDate": "2026-12-31",     // string "YYYY-MM-DD" | null
  "dailyCalorieTarget": 1900,     // number | null
  "updatedAt": "2026-08-07T10:22:31.000Z"  // string ISO | null
}
```

**Không có nhánh 404 để xử.** "Chưa đặt" là một trạng thái hợp lệ của tài nguyên
singleton, không phải tài nguyên vắng mặt (`goal/SPEC.md` §3). UI chỉ render ba ô
trống. Đừng viết `if (res.status === 404)`.

`updatedAt` là trường **chỉ đọc** — chỉ dùng để hiện "Cập nhật lần cuối …", và là
thứ duy nhất phân biệt "chưa từng đặt" với "đã đặt rồi xóa sạch cả ba trường"
(`goal/SPEC.md` §8.1).

### `PUT /api/goal`

Body, cả ba trường **optional + nullable**:

```jsonc
{ "targetWeightKg": 68, "targetDate": "2026-12-31", "dailyCalorieTarget": 1900 }
```

Trả `GoalResponse` (trạng thái sau khi ghi). Lỗi `400` khi Zod fail.

Ràng buộc (`goal/SPEC.md` §1):

| Trường | Ràng buộc | Ghi chú cho UI |
|---|---|---|
| `targetWeightKg` | `> 0` và `< 500` | khoảng **mở** hai đầu — `0` và `500` đều 400 |
| `targetDate` | `"YYYY-MM-DD"`, ngày có thật, **cho phép tương lai** | khác mọi trường `date` khác của dự án; đừng chặn tương lai ở client |
| `dailyCalorieTarget` | số nguyên `0…20 000` | trần này đang lỏng — xem §10 |

Ngữ nghĩa ba trạng thái của upsert (`goal/SPEC.md` §6):

| Trong body | Ý nghĩa |
|---|---|
| trường **vắng mặt** | giữ nguyên giá trị cũ |
| trường mang **`null`** | **xóa** giá trị |
| trường mang giá trị | ghi đè |

Backend phân biệt "vắng mặt" với `null` bằng `key in rawBody` — nên **`null` phải
được serialize thật sự trong JSON**, không được để `undefined` (JSON.stringify sẽ
nuốt mất khóa và biến "xóa" thành "giữ nguyên").

**Luật UI bắt buộc:** ô nhập số để trống → gửi `null`, **không** gửi `''` và
**không** gửi `NaN`. `''` không phải `number` → 400; `NaN` không serialize được
sang JSON hợp lệ.

**Cạm bẫy im lặng:** `goalUpsertSchema` **không** `.strict()` — khóa lạ bị Zod
**strip im lặng** (`goal/SPEC.md` §8.2). Gõ `targetWeight` thay vì
`targetWeightKg` sẽ trả **200 mà không ghi gì**, không có lỗi nào hiện ra. Hệ quả
thực tế: gửi ngược nguyên object nhận từ `GET` (kèm `updatedAt`) là **an toàn**,
nhưng cũng có nghĩa là UI không được trông cậy vào 400 để bắt lỗi chính tả. Cách
phòng: dựng patch bằng một hàm có kiểu tường minh trong `settings.api.ts`, không
spread object tự do.

Ghi chú: `PUT {}` trên DB trắng vẫn tạo một hàng toàn `null` và trả 200
(`goal/SPEC.md` §8.3) — không phải bug, đừng "sửa".

## 4. Nhóm 2 — Nhắc nhở

Nguồn: `docs/features/reminders/SPEC.md` §3, §4, §8.

### `GET /api/reminders`

Không tham số. Trả **mảng trần** (không bọc `{ data }`), **luôn đủ 2 phần tử**,
thứ tự cố định theo `REMINDER_KINDS = ['weigh_in', 'meal_log']`:

```jsonc
[
  { "kind": "weigh_in", "timeOfDay": "07:00", "enabled": false, "ntfyTopic": null },
  { "kind": "meal_log", "timeOfDay": "20:00", "enabled": false, "ntfyTopic": null }
]
```

DB rỗng vẫn trả đúng mảng này — service trộn hàng DB lên trên giá trị mặc định
hard-code và **không seed gì trong GET** (`reminders/SPEC.md` §4). UI vì thế
**không cần** trạng thái "chưa cấu hình": cứ render hai khối, giờ mặc định
`07:00`/`20:00` là gợi ý điền sẵn.

`kind` là khóa nghiệp vụ — dùng nó làm React `key` và làm định danh khi `PUT`.
Response **không** có `id`, `userId`, `updatedAt` và sẽ không bao giờ có
(`reminders/SPEC.md` §8.4).

### `PUT /api/reminders/:kind`

`:kind` ∈ `weigh_in` | `meal_log`. `kind` lạ → **404** và không ghi gì vào DB.
UI không có đường nào sinh ra `kind` lạ nếu lấy `kind` từ response `GET` — đừng
hard-code chuỗi ở chỗ khác.

Body (partial, `.strict()`):

```jsonc
{ "timeOfDay": "07:30", "enabled": true, "ntfyTopic": "lean-abc123" }
```

Trả **một** `ReminderView` sau khi cập nhật (không phải mảng). Chi tiết ngữ nghĩa
và ràng buộc: §8.

### Hình dạng lỗi (chung cho cả hai nhóm)

`docs/overview/04-conventions.md`, hiện thực ở
`server/src/shared/errors/errorHandler.ts`:

```jsonc
// 400
{ "error": { "code": "VALIDATION_ERROR", "message": "…",
              "fields": [{ "path": "ntfyTopic", "message": "…" }] } }
// 404
{ "error": { "code": "NOT_FOUND", "message": "…" } }
```

`fields[].path` là **tên trường** — UI phải map nó về đúng ô nhập và hiện thông
báo ngay dưới ô đó, không đổ một alert chung chung. `message` đã là tiếng Việt
sẵn từ server (`"Topic chỉ gồm chữ, số, gạch ngang và gạch dưới"`), hiện thẳng
được.

## 5. BẮT BUỘC — cảnh báo "chỉ chạy khi server bật, không gửi bù"

**Đây là mục không được cắt khi rút gọn UI.**

Scheduler là `node-cron` chạy **trong tiến trình server**, quét đầu mỗi phút
(`reminders/SPEC.md` §6.4). Hệ quả:

- Máy tắt, sleep, hoặc server chưa chạy vào lúc `07:00` → **nhắc nhở 07:00 hôm đó
  mất luôn.**
- **Không có hàng đợi, không có cơ chế đuổi kịp, không gửi bù khi bật lại.**
- Đây là **hành vi có chủ đích**, chốt ở spec §8
  (`2026-08-06-original-design.md:320`) và ghi lại trong `reminders/SPEC.md` §6.4 — **không
  phải bug, đừng báo bug, đừng tự thêm gửi bù.** Nhắc nhở trễ vài giờ thì vô ích,
  và một hàng đợi gửi bù sẽ bắn cả loạt thông báo cũ mỗi lần mở máy.

Vì sao **phải** hiện lên giao diện: người dùng bật nhắc nhở rồi mặc định tin rằng
app sẽ nhắc mình mỗi ngày. Tin nhầm điều đó dẫn thẳng tới việc **bỏ ghi dữ liệu**
— đúng thứ mà app tồn tại để làm. Ba tài liệu độc lập cùng yêu cầu điều này:
`2026-08-06-original-design.md:305`, `reminders/SPEC.md` §6.4, `reminders/PLAN.md` §5.2, và
`CLAUDE.md` liệt kê nó trong "Cạm bẫy đã biết".

Yêu cầu hiện thực:

- Đặt trong khối Nhắc nhở, **luôn hiển thị** — không phải tooltip, không phải
  accordion đóng sẵn, không phải chỉ hiện khi có lỗi.
- Nội dung tối thiểu, đủ ba ý: *chỉ chạy khi server đang chạy* · *máy tắt là mất
  lượt nhắc đó* · *không gửi bù khi bật lại*.
- Bản nháp câu chữ: **"Nhắc nhở chỉ hoạt động khi server đang chạy. Máy tắt hoặc
  server dừng vào đúng giờ nhắc thì lượt nhắc đó mất — hệ thống không gửi bù khi
  chạy lại."**

## 6. BẮT BUỘC — cảnh báo `enabled: true` mà `ntfyTopic` rỗng

Hành vi backend (`reminders/SPEC.md` §8.5):

- API **chấp nhận** `{ "enabled": true }` khi `ntfyTopic` đang là `null` và trả
  **200**. Có chủ đích: để thao tác "bật trước, điền topic sau" không bị chặn.
- Scheduler thì lọc bỏ nhắc nhở đó ở `selectDueReminders` — điều kiện đến hạn cần
  **cả ba**: `enabled === true` **và** khớp phút **và** `ntfyTopic` sau trim khác
  rỗng (`reminders/SPEC.md` §6.1).
- Việc lọc là **im lặng tuyệt đối**: không gửi, không lỗi, không log cảnh báo,
  không có gì trong response API để client nhìn ra.

Kết quả nếu UI không cảnh báo: người dùng gạt công tắc sang "Bật", thấy 200, thấy
giao diện hiện "Đã lưu", rồi **ngồi chờ mãi không có thông báo nào** và không có
một manh mối nào để lần ra nguyên nhân.

Yêu cầu hiện thực:

- Điều kiện hiện cảnh báo, tính trên state đang hiển thị:
  `enabled === true && (ntfyTopic ?? '').trim() === ''`.
- Hiện **tại chỗ**, ngay trong khối của đúng `kind` đó (mỗi `kind` có topic
  riêng), không phải một banner chung ở đầu trang.
- Phải hiện **ngay khi người dùng gạt công tắc**, trước cả khi bấm lưu — cảnh báo
  chỉ xuất hiện sau khi lưu là đã muộn một nhịp.
- Câu chữ phải nói ra *hệ quả*, không chỉ mô tả trạng thái. Bản nháp: **"Đã bật
  nhưng chưa có topic — sẽ không có thông báo nào được gửi. Nhập topic ntfy để
  nhắc nhở hoạt động."**
- **Không** chặn nút Lưu, **không** tự tắt `enabled`. API cho phép trạng thái này
  một cách có chủ đích; UI cảnh báo chứ không phủ quyết.

## 7. BẮT BUỘC — nút "Gửi thử" bị CHẶN bởi backend

Spec §7 mô tả trang Cài đặt có nút **"Gửi thử"** (`2026-08-06-original-design.md:304`).
**Không có route nào tương ứng.** §5 của spec chỉ liệt kê `GET /reminders` và
`PUT /reminders/:kind` (`2026-08-06-original-design.md:177-195`), và code cũng không có —
`reminders/SPEC.md` §9 và `reminders/PLAN.md` §5.1 đều ghi đây là **lỗ hổng spec
đã biết**.

**Trạng thái của tính năng này: BỊ CHẶN.** Không implement, không gọi thử một URL
đoán được, không giả lập bằng cách `PUT` rồi chờ. Hai lựa chọn hợp lệ cho vòng
đầu:

- (a) Không render nút — đơn giản nhất, và không hứa gì với người dùng.
- (b) Render nút ở trạng thái `disabled` kèm chú thích "chưa hỗ trợ".

Khuyến nghị **(a)**: một nút xám không giải thích được thì chỉ tạo nghi ngờ về
chất lượng app.

Endpoint dự kiến khi backend bổ sung (`reminders/PLAN.md` §5.1):

```
POST /api/reminders/:kind/test  →  200 { sent: boolean, reason?: string }
```

**Bốn điểm cần chủ dự án chốt trước khi ai đó code phần này:**

1. **Gửi với topic nào?** Topic đã lưu trong DB, hay topic client đang gõ dở
   trong ô nhập và gửi kèm body? Người dùng gần như luôn bấm "Gửi thử" **trước**
   khi bấm Lưu — nếu endpoint chỉ đọc DB thì nút sẽ test sai topic và người dùng
   không hiểu vì sao.
2. **Có bỏ qua điều kiện `needsReminder` không?** Gửi thử phải gửi ngay cả khi
   hôm nay đã ghi cân, nếu không thì nút vô dụng đúng với người dùng chăm chỉ
   nhất.
3. **Có bỏ qua `enabled` không?** Gần như chắc chắn là có — người ta bấm gửi thử
   để quyết định *có nên bật hay không*.
4. **Hình dạng response khi ntfy hỏng.** `sendNtfyNotification` không ném lỗi, nó
   trả `{ sent: false, reason }` với `reason` ∈ `no-topic` | `network-error` |
   `http-error` (`reminders/SPEC.md` §7). Endpoint nên trả nguyên `reason` đó
   thay vì `500`, để UI phân biệt được "topic sai" với "mất mạng" — hai thứ cần
   hai câu hướng dẫn hoàn toàn khác nhau.

Phần khó đã có sẵn: `sendNtfyNotification` và bảng `NOTIFICATIONS` dùng lại được
nguyên vẹn; việc còn lại thuần là chốt hợp đồng API (`reminders/PLAN.md` §5.1).

## 8. BẮT BUỘC — ngữ nghĩa `PUT /api/reminders/:kind`

Bốn luật, mỗi luật đều đã có test canh ở backend.

**8.1 Partial update.** Giống `PUT /body-logs/:date` và `PUT /goal`
(`reminders/SPEC.md` §3):

| Trong body | Ý nghĩa |
|---|---|
| trường **vắng mặt** | giữ nguyên giá trị cũ |
| `"ntfyTopic": null` | **xóa** topic |
| trường mang giá trị | ghi đè |

Gửi `{ "enabled": true }` **không** đụng tới `timeOfDay` và `ntfyTopic`. Đây là
thứ cho phép UI gạt công tắc mà không cần gửi kèm cả form.

**8.2 Body là `.strict()`** — gõ sai tên trường (`timeOfDayy`, `topic`,
`ntfy_topic`) trả **400**, không im lặng bỏ qua
(`server/src/features/reminders/dtos/reminders.request.ts:38`). Khác hẳn
`PUT /goal` (§3, strip im lặng). **Hệ quả trực tiếp:** không được gửi ngược nguyên
object `ReminderView` nhận từ `GET` — nó có khóa `kind`, mà `kind` **không** nằm
trong schema body → 400. Phải bóc ra đúng ba khóa `timeOfDay`, `enabled`,
`ntfyTopic`.

**8.3 `ntfyTopic` có ràng buộc định dạng thật.** Regex lấy nguyên từ
`reminders.request.ts:20-26`:

```ts
z.string().trim().min(1, 'Topic không được rỗng').max(64)
 .regex(/^[A-Za-z0-9_-]+$/, 'Topic chỉ gồm chữ, số, gạch ngang và gạch dưới')
 .nullable()
```

Tức là: **trim trước**, dài **1–64**, chỉ `[A-Za-z0-9_-]`, hoặc `null`.

- Ô trống → phải gửi **`null`**, không gửi `''`. `''` sau trim là rỗng → **400**
  (`min(1)`), trong khi ý người dùng là "xóa topic đi". Map `'' → null` ngay tại
  `settings.api.ts`.
- Khoảng trắng đầu/cuối được server trim, nhưng khoảng trắng **ở giữa** thì
  không — `"my topic"` là 400. Nói trước điều đó trong hint dưới ô nhập, đừng để
  người dùng phải đoán từ thông báo lỗi.
- Lý do ràng buộc chặt: topic đi thẳng vào path URL của ntfy; ký tự `/` hay
  khoảng trắng đẻ ra URL sai hoặc topic ngoài ý muốn (`reminders/SPEC.md` §8.1).

**8.4 `timeOfDay` khớp `^([01]\d|2[0-3]):[0-5]\d$`** —
`server/src/shared/validation/commonSchemas.ts:26-28`. Đúng `"HH:mm"` 24 giờ,
`00:00`–`23:59`, giờ `Asia/Ho_Chi_Minh`.

Cạm bẫy hiện thực: `<input type="time">` trả `"HH:mm"` như mong đợi, **nhưng nếu
đặt `step` xuống mức giây thì trình duyệt trả `"HH:mm:ss"`** — chuỗi đó **400**.
Đừng đặt `step` nhỏ hơn `60`.

## 9. Hướng dẫn người dùng — ntfy

Không có mục này thì ô "topic" là một ô trống vô nghĩa và tính năng nhắc nhở coi
như không tồn tại. Đặt ngay trong khối Nhắc nhở, dạng nội dung có thể thu gọn
(mặc định thu gọn được — khác với cảnh báo §5 phải luôn hiện).

Nội dung tối thiểu, bốn ý:

1. **ntfy là gì:** dịch vụ gửi thông báo đẩy miễn phí. Server Lean gửi một tin
   HTTP tới `https://ntfy.sh/<topic>`; điện thoại nào đang đăng ký `<topic>` thì
   nhận được thông báo. Không cần tài khoản, không cần đăng nhập.
2. **Topic là gì:** một chuỗi tự đặt, đóng vai trò địa chỉ. **Bất kỳ ai biết
   chuỗi đó cũng đọc được thông báo của bạn** — nên đặt chuỗi dài và khó đoán
   (`lean-7f3ka92x` chứ không phải `lean`). Đây là điều bắt buộc phải nói với
   người dùng, không phải chi tiết kỹ thuật thừa.
3. **Cách đăng ký trên điện thoại:** cài app **ntfy** (App Store / Google Play /
   F-Droid) → bấm **+** → nhập đúng chuỗi topic đã điền ở đây → Subscribe. Cũng
   xem được trên web tại `https://ntfy.sh/<topic>`.
4. **Ký tự cho phép:** chữ, số, `-`, `_`; tối đa 64 ký tự (khớp §8.3).

Ghi chú kỹ thuật cho người implement, **không** hiện lên UI: server đích lấy từ
biến môi trường `NTFY_BASE_URL`, mặc định `https://ntfy.sh`
(`server/src/config/env.ts:6`). Nếu người dùng tự host ntfy thì hướng dẫn ở ý 3
sai — nhưng cấu hình đó nằm ở `.env` của server, ngoài tầm với của trang này.

## 10. Câu hỏi mở

**10.1 Trần của `dailyCalorieTarget` — cần chủ dự án chốt con số.**

`dailyCalorieTarget` đang dùng chung `caloriesSchema` với calo của **một bữa ăn**
(`goal/SPEC.md` §1, `goal/PLAN.md` §4):

```ts
export const caloriesSchema = z.number().int().min(0).max(20_000);
```

Lấy **trần một bữa làm trần cả ngày** là ràng buộc lỏng — 20 000 kcal/ngày là con
số vô nghĩa về mặt sinh lý, nên trường này thực tế gần như không được kiểm chặn
phía trên. Hai điểm cần chốt (`goal/PLAN.md` §4):

1. Trần hợp lý cho mục tiêu calo một ngày? (tham chiếu: người trưởng thành thường
   1 200 – 4 000 kcal/ngày)
2. Sàn có nên lớn hơn `0`? Hiện `0` hợp lệ, tức đặt mục tiêu nhịn hoàn toàn.

**Trang web KHÔNG được tự đặt trần riêng ở client.** Client chặn chặt hơn server
nghĩa là hai nguồn chân lý lệch nhau, và người sau sẽ sửa nhầm chỗ. Khi có số,
sửa **một chỗ**: thêm `dailyCalorieTargetSchema` vào
`shared/validation/commonSchemas.ts` rồi trỏ `goal.request.ts:24` sang schema mới
— **không** sửa `caloriesSchema`, `meals` đang phụ thuộc nó với ngữ nghĩa khác.

**10.2 Hợp đồng của "Gửi thử"** — bốn điểm ở §7. Chặn tính năng, không chặn trang.

**10.3 Lưu tay hay lưu tự động?** Trang Hôm nay lưu tự động khi blur
(`2026-08-06-original-design.md:296`). Spec **không** nói gì về trang Cài đặt. Đề xuất: **lưu
tay bằng nút, tách riêng cho từng nhóm** — cài đặt là thứ người ta sửa vài tháng
một lần, và một cú blur nhầm không nên ghi đè mục tiêu. Cần chốt trước khi code
`useSettings`.

**10.4 Có hiện `updatedAt` của mục tiêu không?** Trường đã có sẵn trong response
(§3). Nghiêng về **có** — nó trả lời câu "mục tiêu này đặt từ bao giờ", và là
cách duy nhất phân biệt "chưa từng đặt" với "đã xóa sạch". Định dạng hiển thị
theo `Asia/Ho_Chi_Minh`, không hiện chuỗi ISO thô.
