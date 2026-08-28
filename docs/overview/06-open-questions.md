# Câu hỏi còn treo

File này gom **mọi thứ chưa được chốt** trong dự án về một chỗ: §12 của spec gốc
(`2026-08-06-original-design.md`) cộng với phần "việc còn treo" của cả 5 feature backend đã code xong.

Hai loại, đừng trộn lẫn:

- **Câu hỏi thiết kế (Q)** — code đang hành xử *một cách hợp lệ*, nhưng chưa ai xác nhận đó là
  cách muốn. Không sửa được cho tới khi có người quyết.
- **Khiếm khuyết (D)** — biết là sai hoặc thiếu, hướng sửa đã rõ, chỉ còn là lúc nào làm.

Liên quan: [`00-goals-and-scope.md`](00-goals-and-scope.md) ·
[`04-conventions.md`](04-conventions.md) · `../features/<tên>/PLAN.md` (nguồn của phần lớn mục
dưới đây, có dẫn `đường-dẫn:dòng`).

> **Cập nhật 2026-08-07 → 2026-08-28.** Dự án chốt là **sẽ có đăng nhập và phân quyền**, và giai
> đoạn A–D nay **đã xong**. Quyết định đó sinh ra Q12–Q15 (đã trả lời — xem cập nhật trong từng
> mục), sửa trạng thái của Q11, và chạm vào vài mục cũ — những mục bị chạm đều có dòng
> *"Ảnh hưởng của quyết định auth/rbac"* ngay trong mục. Các câu hỏi thuộc riêng hai feature đó
> **không** gom về đây; chúng nằm ở `../features/auth/PLAN.md` và `../features/rbac/PLAN.md`.

---

## Bảng tóm tắt

| # | Vấn đề | Loại | Chặn ai |
|---|---|---|---|
| Q1 | Trần và sàn của `dailyCalorieTarget` | thiết kế | `goal`, trang Cài đặt |
| Q2 | Nút "Gửi thử" không có route trong spec | thiết kế (lỗ hổng spec) | trang Cài đặt |
| Q3 | `from`/`to` không bị cấm ở tương lai | thiết kế | `summary`, `body-logs`, trang Biểu đồ |
| Q4 | Thứ tự `GET /api/meals?date=` | thiết kế | trang Hôm nay |
| Q5 | Vẽ tuần rỗng: đứt đoạn hay nối thẳng | thiết kế | trang Biểu đồ |
| Q6 | Tuần đầu/cuối bị cắt cụt trông như tuần đủ | thiết kế | trang Biểu đồ |
| Q7 | Cảnh báo `enabled: true` mà thiếu `ntfyTopic` | thiết kế | trang Cài đặt |
| Q8 | Lỗi `:date` che mất lỗi body khi `PUT /body-logs` | thiết kế | trang Hôm nay |
| Q9 | Đơn vị đo kg/cm | thiết kế | toàn bộ UI |
| Q10 | Bốn buổi ăn đã đủ chưa | thiết kế | `meals`, trang Hôm nay |
| Q11 | SQLite + không đăng nhập | **đã chốt, nay mở lại một nửa** (2026-08-07) | mọi thứ dưới đây |
| Q12 | Bao giờ bật auth, và bật theo trình tự nào | thiết kế | `auth`, `rbac`, mọi feature đang chạy |
| Q13 | Dữ liệu `userId = 'local'` migrate thế nào | thiết kế | `auth`, dữ liệu hiện có |
| Q14 | Đăng ký tự do hay chỉ admin tạo tài khoản | thiết kế | `auth` |
| Q15 | Admin có được xem dữ liệu sức khỏe của người khác không | **quyền riêng tư**, không phải kỹ thuật | `rbac` |
| D1 | Biên 730 ngày: `<` hay `<=`, và không có test biên | khiếm khuyết | không ai |
| D2 | `note` trim nhưng thiếu `.min(1)` → `""` thay vì `null` | khiếm khuyết | trang Hôm nay |
| D3 | `updatedAt` bị bump khi `PATCH /meals/:id` không đổi gì | khiếm khuyết | trang Hôm nay |
| D4 | Thiếu test cho vài ranh giới của `body-logs` | khiếm khuyết | không ai |
| D5 | Hạn chế "không gửi bù" chưa hiện trên giao diện | khiếm khuyết | trang Cài đặt |
| D6 | `Meal.note` không giới hạn độ dài | khiếm khuyết có điều kiện | — |
| D7 | `asRecord()` có nhánh chết | dọn dẹp | — |

---

## Câu hỏi thiết kế

### Q1. Trần và sàn của `dailyCalorieTarget`

**Bối cảnh.** `dailyCalorieTarget` đang validate bằng `caloriesSchema`
(`z.number().int().min(0).max(20_000)`, `shared/validation/commonSchemas.ts:23`) — schema mà
spec §5 định nghĩa cho calo của **một bữa ăn**, và `meals` đang dùng đúng nó với ngữ nghĩa đó.

**Vì sao cần quyết.** Lấy trần một bữa làm trần cả ngày là ràng buộc rỗng: 20 000 kcal/ngày vô
nghĩa về sinh lý, nên trường này thực tế không được kiểm chặn phía trên. Sàn `0` cũng chấp nhận
mục tiêu "nhịn hoàn toàn". Không tự chốt được vì đây là **quyết định sản phẩm**, không phải kỹ
thuật — spec không định nghĩa luật riêng cho mục tiêu calo ngày.

**Lựa chọn.**
1. Giữ nguyên `0–20 000`, chấp nhận trường gần như không validate.
2. Thêm `dailyCalorieTargetSchema` riêng, ví dụ `800–6 000` (khẩu phần người trưởng thành
   thường 1 200–4 000 kcal/ngày). Sàn nên `> 0` hay không cũng phải chốt cùng lúc.

**Ảnh hưởng.** Sửa ở **một chỗ**: thêm schema mới vào `shared/validation/commonSchemas.ts` rồi
trỏ `features/goal/dtos/goal.request.ts:24` sang. **Không sửa `caloriesSchema`** — `meals` phụ
thuộc nó với ngữ nghĩa khác. Nếu siết trần, dữ liệu cũ ngoài khoảng mới sẽ không sửa được qua
API cho tới khi người dùng nhập lại giá trị hợp lệ.

Nguồn: `features/goal/PLAN.md` §4.

### Q2. Nút "Gửi thử" không có route trong spec

**Bối cảnh.** Spec §7 mô tả trang Cài đặt có nút **"Gửi thử"** (`2026-08-06-original-design.md:304`), nhưng
§5 không liệt kê route nào tương ứng (`2026-08-06-original-design.md:177-195` chỉ có `GET /reminders` và
`PUT /reminders/:kind`). Backend cũng chưa làm.

**Vì sao cần quyết.** Đây là lỗ hổng thật của spec, không phải việc bị bỏ sót lúc code. Không
có endpoint này thì người dùng bật nhắc nhở xong không có cách nào biết topic mình gõ có đúng
không — cho tới sáng hôm sau.

**Lựa chọn.** Hình dạng đề xuất: `POST /api/reminders/:kind/test → 200 { sent, reason? }`. Bốn
điểm phải chốt kèm theo:
1. Gửi với topic nào — topic đã lưu trong DB, hay topic client đang gõ dở và gửi kèm body?
   (Người dùng thường bấm "Gửi thử" *trước* khi bấm Lưu.)
2. Có bỏ qua điều kiện `needsReminder` không? Phải có — nếu không thì nút vô dụng với người đã
   ghi cân hôm đó.
3. Có bỏ qua `enabled` không? Gần như chắc chắn là có.
4. Response khi ntfy hỏng. `sendNtfyNotification` **không ném lỗi**, nó trả
   `{ sent: false, reason }` (`shared/clients/ntfy.client.ts:11-15`) — endpoint nên trả nguyên
   `reason` thay vì `500`, để UI phân biệt "topic sai" với "không có mạng".

**Ảnh hưởng.** Thêm route vào feature `reminders`; phần khó đã có sẵn (`sendNtfyNotification`,
`NOTIFICATIONS` tại `reminders.scheduler.ts:49-60` dùng lại nguyên vẹn). Cần chốt **trước khi**
bắt tay làm trang Cài đặt.

Nguồn: `features/reminders/PLAN.md` §5.1.

### Q3. `from`/`to` không bị cấm nằm ở tương lai

**Bối cảnh.** `dateRangeSchema` dựng trên `dateString`, không phải `pastOrTodayDateString`
(`shared/validation/commonSchemas.ts:34-43` so với `:16`), trong khi `:date` của một bản ghi
thì **có** chặn tương lai. Nên `GET /api/summary?to=2099-12-31` trả `200` với phần đuôi toàn
`null`/`0`; `GET /api/body-logs?to=2099-12-31` cũng vậy.

**Vì sao cần quyết.** Khớp bảng validate của spec §5 (quy tắc "không được ở tương lai" chỉ gắn
cho `date` của bản ghi), nên **không phải bug** — nhưng cũng chưa ai xác nhận là muốn thế. Rủi
ro còn lại: bug ở client gửi `to` lệch (ví dụ +1 năm do lỗi múi giờ) sẽ không bị phát hiện.

**Lựa chọn.**
1. Giữ nguyên, chặn ở web nếu cần. Ràng buộc thật sự bảo vệ hệ thống là trần 730 ngày và nó vẫn
   áp dụng.
2. Chặn ở backend: đổi `dateRangeSchema` — nhưng schema này **dùng chung**, đổi là ảnh hưởng cả
   `GET /api/summary` lẫn `GET /api/body-logs?from=&to=`, và buộc client phải tự kẹp `to` về
   hôm nay trước mỗi lần gọi.

**Câu hỏi cụ thể cần trả lời:** bộ chọn khoảng ở trang Biểu đồ có bao giờ sinh ra `to` ở tương
lai không (ví dụ "3 tháng tới" để nhìn đường mục tiêu)? Nếu có thì lựa chọn 2 tự loại.

*Ảnh hưởng của quyết định auth/rbac: **không đổi**.* Đây là câu hỏi về ngữ nghĩa khoảng ngày,
độc lập với việc ai đang đăng nhập.

Nguồn: `features/summary/PLAN.md` §4.3, `features/body-logs/PLAN.md` §4.1 (hai feature nêu cùng
một vấn đề).

### Q4. Thứ tự `GET /api/meals?date=`

**Bối cảnh.** `repositories/meals.repository.ts:37` sắp theo `createdAt: 'asc'` — thứ tự người
dùng đã nhập, **không** theo thứ tự bữa trong ngày.

**Vì sao cần quyết.** Ai ghi bù bữa sáng vào buổi tối sẽ thấy bữa sáng nằm cuối danh sách.
Chưa quyết được vì trang Hôm nay chưa dựng.

**Lựa chọn.**
1. Giữ hợp đồng server, sắp ở frontend theo mảng thứ tự `slot` tường minh.
2. Đổi `orderBy` ở server. **Cạm bẫy:** `slot` là `String` trong SQLite
   (`prisma/schema.prisma:41`) nên `orderBy: { slot: 'asc' }` cho ra thứ tự bảng chữ cái
   `breakfast, dinner, lunch, snack` — **sai**. Phải sắp trong bộ nhớ theo mảng thứ tự.

**Ảnh hưởng.** Không test nào khóa thứ tự hiện tại (test dòng `62-65` `.sort()` trước khi so
sánh) — đổi được mà không phá test, nhưng cũng có nghĩa hợp đồng này **chưa được bảo vệ**. Nếu
chốt lựa chọn 1, nên thêm test khóa thứ tự hiện tại lại.

Nguồn: `features/meals/PLAN.md` §4.2.

### Q5. Vẽ tuần rỗng: đứt đoạn hay nối thẳng

**Bối cảnh.** `weeks` trong `GET /api/summary` trả **mọi** tuần chạm khoảng, kể cả tuần không có
dữ liệu — phần tử `{ weekStart, avgCalories: null, avgWeightKg: null }`
(`shared/stats/weekly.ts:76-91`, có test canh). Chốt như vậy để web vẽ trục thời gian mà không
phải tự bù tuần thiếu.

**Vì sao cần quyết.** Biểu đồ nối thẳng qua điểm `null` sẽ **vẽ ra một xu hướng không tồn tại** —
đúng loại lỗi đọc biểu đồ mà cả app này sinh ra để tránh.

**Lựa chọn.** Vẽ đứt đoạn tại tuần `null` (khuyến nghị) · nối thẳng · hoặc hiện dấu riêng cho
tuần trống.

**Ảnh hưởng.** Thuần frontend, không đụng hợp đồng API.

Nguồn: `features/summary/PLAN.md` §4.1.

### Q6. Tuần đầu/cuối bị cắt cụt trông như tuần đủ

**Bối cảnh.** Nếu `from` rơi vào thứ Năm, phần tử đầu của `weeks` vẫn báo `weekStart` là thứ Hai
**trước** `from` (`weekly.ts:79`) — một ngày ngoài khoảng người dùng xin. Nhưng trung bình chỉ
tính trên các ngày thật sự trong `[from, to]` (`weekly.ts:49`).

**Vì sao cần quyết.** Tuần đầu và tuần cuối **không so sánh ngang hàng được** với các tuần trọn
vẹn ở giữa: một tuần chỉ có 3 ngày dữ liệu vẫn hiện như một điểm bình đẳng trên biểu đồ.

**Lựa chọn.** Làm mờ/đánh dấu hai điểm đầu-cuối · bỏ hẳn tuần cắt cụt khi vẽ · giữ nguyên.
Backend không tự quyết vì `weeks` cũng dùng cho bảng số, nơi mọi tuần đều đáng hiện.

**Ảnh hưởng.** Response hiện **không có** trường nào cho biết một tuần bị cắt cụt (`SummaryWeek`
chỉ có 3 trường, `dtos/summary.response.ts:20-25`). Nếu web cần biết, đó là **thay đổi hợp
đồng** và phải sửa `shared/stats/weekly.ts`, không sửa trong feature `summary`.

Nguồn: `features/summary/PLAN.md` §4.2.

### Q7. Cảnh báo `enabled: true` mà thiếu `ntfyTopic`

**Bối cảnh.** API chấp nhận `enabled: true` khi `ntfyTopic` rỗng và trả `200`, nhưng scheduler
lọc bỏ **im lặng** — không gửi gì cả.

**Vì sao cần quyết.** Người dùng bật công tắc, thấy `200`, tưởng nhắc nhở đang hoạt động, và
không bao giờ nhận được gì.

**Lựa chọn.**
1. Cảnh báo tại chỗ trên trang Cài đặt (khuyến nghị — giữ API mềm).
2. Siết ở API: `enabled: true` mà thiếu topic → `400`. Đổi hợp đồng, và làm khó thao tác "bật
   trước, nhập topic sau".

**Ảnh hưởng.** Lựa chọn 2 sửa `dtos/reminders.request.ts` và có thể phá test hiện có.

Nguồn: `features/reminders/PLAN.md` §5.3, `features/reminders/SPEC.md` §8 mục 5.

### Q8. Lỗi `:date` che mất lỗi body khi `PUT /body-logs/:date`

**Bối cảnh.** Controller validate `:date` trước rồi mới tới body
(`controllers/bodyLogs.controller.ts:34-35`). `PUT /api/body-logs/2099-01-01` với body
`{ weightKg: -5 }` trả `400` **chỉ nêu lỗi `date`**.

**Vì sao cần quyết.** Là lựa chọn có chủ ý (ngày tương lai phải bị chặn kể cả khi body hỏng),
nhưng có giá: form trên web có thể phải qua hai vòng mới thấy hết lỗi. Chỉ biết được có khó
chịu thật hay không khi trang Hôm nay đã dựng.

**Lựa chọn.** Giữ nguyên · hoặc gộp `params` và `body` vào **một** schema rồi `.parse()` một
lần — Zod trả cả hai nhóm `issue`.

**Ảnh hưởng.** Đổi thì hình dạng lỗi `400` của endpoint này thay đổi; test hiện có phải sửa.

Nguồn: `features/body-logs/PLAN.md` §4.2.

### Q9. Đơn vị đo

Mặc định **kg** và **cm**, đang khóa cứng trong ràng buộc validate (`weightKg` `0–500`,
`waistCm` `0–300`) và trong tên cột. Đổi được nhưng **nên chốt bây giờ**: sau khi có dữ liệu
thật thì đổi đơn vị là migrate dữ liệu, không phải đổi nhãn.

*Ảnh hưởng của quyết định auth/rbac: **gấp hơn trước**.* Lập luận "chốt sớm vì sau này migrate
tốn" giữ nguyên, nhưng với nhiều người dùng thì còn thêm một câu hỏi mới: đơn vị là **một lựa
chọn chung cho cả hệ thống**, hay là **tùy chọn của từng người dùng** (kg/cm với người này,
lb/in với người kia)? Hướng thứ hai kéo theo cột thiết lập trên `User` và quy đổi ở tầng hiển
thị — rẻ nếu quyết trước khi có dữ liệu thật, đắt nếu quyết sau.

Nguồn: `2026-08-06-original-design.md` §12 mục 2; ghi chú bổ sung 2026-08-07.

### Q10. Bốn buổi ăn đã đủ chưa

`slot ∈ ["breakfast", "lunch", "dinner", "snack"]`. Thêm buổi mới về sau là chuyện nhỏ (thêm
vào mảng ở `dtos/meals.request.ts`, `slot` là `String` nên không phải migrate), nhưng dữ liệu
cũ sẽ không tự phân loại lại. Chốt sớm thì thống kê theo buổi mới nhất quán.

Nguồn: `2026-08-06-original-design.md` §12 mục 3.

### Q11. SQLite + không đăng nhập — **đã chốt, nay mở lại một nửa**

> **Cập nhật 2026-08-07 — nửa "SQLite" đã chốt lại: GIỮ SQLite.**
>
> Chủ dự án hỏi có cần dựng sẵn DB Postgres không. Trả lời: **chưa cần**.
>
> Lý do nêu Postgres là SQLite chỉ cho **một tiến trình ghi tại một thời điểm**, mà mỗi lần
> đăng nhập ghi ít nhất 2 hàng. Nhưng hiện có **một** người dùng; đổi ngay là phải vận hành
> thêm một dịch vụ và mất thứ đang tiện nhất — sao lưu = copy một file.
>
> **Đính chính một điều tôi từng nói sai:** chi phí đổi **không** tăng theo tiến độ code auth.
> Tầng `repositories/` cô lập Prisma và `prisma.config.ts` giữ connection string một chỗ, nên
> đổi `provider` + viết migration là xong. Cái đắt là lúc **đã có dữ liệu thật của nhiều
> người** phải chuyển — không phải lúc viết code auth.
>
> **Mốc đổi: khi có người dùng thật thứ hai.** Trước đó đừng đổi.

Ghi lại ở đây để không ai mở lại vô cớ. Lý do đầy đủ ở
[`01-architecture.md`](01-architecture.md). Chỉ mở lại khi **bối cảnh đổi**: mở app ra LAN hoặc
cloud — và khi đó auth là **bắt buộc**, không phải tùy chọn. Đổi lúc này sẽ đụng
`schema.prisma`, `app.ts` và toàn bộ tầng test.

**Cập nhật 2026-08-07 → 2026-08-28 — bối cảnh đã đổi, và đã làm xong.** Chủ dự án nêu hướng
nhiều người dùng và yêu cầu phân quyền; đăng nhập và phân quyền nay nằm trong phạm vi
([`00-goals-and-scope.md`](00-goals-and-scope.md) §2,
[`../features/auth/SPEC.md`](../features/auth/SPEC.md),
[`../features/rbac/SPEC.md`](../features/rbac/SPEC.md)) và **đã triển khai xong** (giai đoạn
A–D). Bản đang chạy có phiên đăng nhập, CSRF, chống brute-force và phân quyền —
**vẫn chỉ giới hạn ở localhost**, nhưng vì lý do khác: chưa có audit log cho thao tác RBAC, và
cache quyền nằm trong bộ nhớ tiến trình nên chạy nhiều instance sẽ sai im lặng.

Nửa "SQLite" **vẫn đang chốt** cho tới khi có ai quyết ngược lại — nhưng lập luận đỡ nó ("một
người dùng, một tiến trình ghi") đã yếu đi từ khi có đăng nhập thật, nên đây là mục sẽ phải xem
lại sớm, không phải mục yên ổn nữa. Q12–Q15 dưới đây là các câu hỏi sinh ra từ quyết định thêm
auth/rbac — cả bốn nay đã có câu trả lời.

Nguồn: `2026-08-06-original-design.md` §12 mục 1; cập nhật 2026-08-07 theo yêu cầu của chủ dự án.

### Q12. Bao giờ bật auth, và bật theo trình tự nào — **đã trả lời**

> **Cập nhật 2026-08-28.** Bật một lần cho toàn bộ API, không bật dần từng feature:
> `requireAuth` mắc đúng một lần ở `app.ts`, `permissionGuard` mắc đúng một lần ở `/api`, mặc
> định TỪ CHỐI — route không khai trong `permissionRegistry.ts` trả `403`. Không có đường thoát
> tạm thời nào được giữ lại.

**Bối cảnh (lúc còn mở).** Có spec cho `auth` và `rbac`, chưa có code. Năm feature backend đang
chạy đều giả định một hằng người dùng cố định và không middleware nào đứng trước chúng để xác
thực request.

**Vì sao cần quyết.** Ngày bật auth là ngày mọi route hiện có đổi hành vi cùng lúc. Trước đó,
mỗi ngày app còn chạy ngoài localhost là một ngày dữ liệu sức khỏe phơi ra; sau đó, mọi test
đang pass đều phải mang phiên đăng nhập.

Nguồn: quyết định 2026-08-07, trả lời 2026-08-28. Chi tiết trình tự thuộc `../features/auth/PLAN.md`.

### Q13. Dữ liệu người dùng cũ migrate thế nào — **đã trả lời**

> **Cập nhật 2026-08-28 — đã xong.** Tài khoản `trang1302@uitgis.vn` là chủ dữ liệu. Bốn bảng
> dữ liệu nay có khóa ngoại `NOT NULL` tới `User`; hằng số cũ dùng để đánh dấu bản ghi trước khi
> có tài khoản thật đã bị xóa khỏi code.

> **Cập nhật 2026-08-07 — email đã có, phần còn lại vẫn mở.**
>
> Chủ dự án cung cấp email cho tài khoản đầu tiên: **`trang1302@uitgis.vn`**.
>
> **Mật khẩu KHÔNG được ghi vào bất kỳ file nào trong repo** — kể cả script seed, kể cả
> `.env.example`. Nhét vào script seed là nó nằm trong lịch sử git vĩnh viễn, và xóa file
> sau đó không gỡ được nó ra khỏi các commit cũ.
>
> Hai cách hợp lệ, `auth/PLAN.md` chọn một khi implement:
> 1. Migrate tạo tài khoản **chưa có mật khẩu**, người dùng đặt ở lần đăng nhập đầu.
> 2. Truyền qua biến môi trường **một lần** lúc chạy migrate, không lưu lại.
>
> Trong DB luôn là băm Argon2id, không bao giờ là chuỗi đọc được.

**Bối cảnh (lúc còn mở).** Mọi bản ghi khi đó mang một giá trị cố định, một chuỗi tự do không
trỏ tới hàng nào. Bảng `User` chưa tồn tại ([`02-data-model.md`](02-data-model.md)).

**Vì sao cần quyết.** Đây là dữ liệu sức khỏe thật đã ghi tay hàng ngày — mất là mất hẳn, không
tái tạo được. Ràng buộc khóa ngoại bật trước khi migrate sẽ làm hỏng hoặc chặn toàn bộ.

**Cần trả lời.** Ai là chủ mới của đống dữ liệu đó — tạo sẵn một `User` cho chủ máy, hay để lần
đăng ký đầu tiên nhận? Migrate tự động lúc khởi động hay bằng script chạy tay có xác nhận? Nếu
người ta không muốn nhận thì xóa hay giữ mồ côi?

Nguồn: quyết định 2026-08-07.

### Q14. Đăng ký tự do hay chỉ admin tạo tài khoản — **đã trả lời**

> **Cập nhật 2026-08-28.** Đăng ký mở công khai (`POST /api/auth/register`, không cần đăng
> nhập trước). Vai trò gán cứng phía server (mặc định `USER`) — **không** đọc từ body request.

**Bối cảnh (lúc còn mở).** Chưa chốt cách một người có tài khoản.

**Vì sao cần quyết.** Hai hướng kéo theo hai bộ tính năng khác hẳn nhau: đăng ký mở cần xác minh
email, chống bot, luồng quên mật khẩu; admin cấp tài khoản thì cần màn hình quản trị và luồng
mời. Chọn sai hướng rồi đổi là làm lại phần lớn `auth`.

**Cần trả lời.** Mở đăng ký cho bất kỳ ai, hay đóng và chỉ admin tạo? Có trạng thái trung gian
(mời qua link, danh sách cho phép) không?

Nguồn: quyết định 2026-08-07. Hình dạng cụ thể thuộc `../features/auth/SPEC.md`.

### Q15. Admin có được xem dữ liệu sức khỏe của người khác không — **đã trả lời**

> **Cập nhật 2026-08-28.** Không. RBAC gác chức năng (403), ownership gác hàng dữ liệu (404) —
> hai lớp tách rời. `SYSTEM_ADMIN` có quyền `log:view` vẫn **không** đọc được nhật ký của người
> khác; quyền đó chỉ mở chức năng, không mở hàng dữ liệu của người khác. Admin quản lý tài
> khoản và vai trò, không quản lý số đo cơ thể.

**Đây là câu hỏi quyền riêng tư, không phải câu hỏi kỹ thuật.** Kỹ thuật thì làm kiểu gì cũng
được; cái phải quyết là **có nên**.

**Bối cảnh (lúc còn mở).** Cân nặng, vòng bụng và nhật ký ăn uống là dữ liệu sức khỏe cá nhân. Một vai trò
"admin" mặc định-thấy-tất-cả là chuyện thường thấy trong phần mềm quản trị, và ở đây nó có nghĩa
là một người xem được toàn bộ lịch sử cơ thể của người khác.

**Cần trả lời.** Admin chỉ quản lý tài khoản và vai trò (khóa, đổi quyền, xóa) mà **không** đọc
được số đo? Hay có đọc được, và nếu có thì trong trường hợp nào, người bị xem có được báo không,
có ghi vết truy cập không? Câu trả lời quyết định `rbac` chia quyền theo "quản trị tài khoản" và
"đọc dữ liệu sức khỏe" thành hai nhóm tách rời hay gộp một.

Đừng để mặc định rơi vào "admin thấy tất cả" chỉ vì đó là cách dễ code nhất.

Nguồn: quyết định 2026-08-07. Mô hình quyền thuộc `../features/rbac/SPEC.md`.

---

## Khiếm khuyết cần sửa

### D1. Biên 730 ngày: `<` hay `<=`, và không có test biên

**Vấn đề.** Ràng buộc thật trong code là `daysBetween(from, to) < 730`
(`commonSchemas.ts:40`), tức chênh lệch tối đa được chấp nhận là **729 ngày**, tương ứng **730
ngày lịch nếu đếm inclusive** cả `from` lẫn `to`. Spec chỉ viết "khoảng tối đa 730 ngày" mà
không nói đếm kiểu nào — nên không có cách nào biết `< 730` là đúng ý hay lệch một đơn vị.

**Vì sao là khiếm khuyết chứ không phải câu hỏi thiết kế.** Dù chốt kiểu đếm nào thì việc
**không có test biên** vẫn là lỗ hổng: test hiện tại dùng 800 ngày (`summary.controller.test.ts:315-323`)
và `-800` (`bodyLogs.controller.test.ts:374-384`) — trượt xa khỏi biên. Đổi `<` thành `<=`
không test nào bắt được.

**Cần làm.** (a) Chốt inclusive hay exclusive rồi ghi thẳng vào
[`04-conventions.md`](04-conventions.md) bảng validate; (b) thêm test **729 pass / 730 trả 400**.
Ràng buộc thuộc `shared/validation` nên test biên nên nằm ở suite của `shared`, không nằm trong
feature nào.

Nguồn: `features/summary/PLAN.md` §4.5, `features/body-logs/PLAN.md` §4.4.

### D2. `note` trim nhưng thiếu `.min(1)` → `""` thay vì `null`

**Vấn đề.** `noteSchema = z.string().trim()...` ở **cả hai** feature
(`features/body-logs/dtos/bodyLogs.request.ts:11` và `features/meals/dtos/meals.request.ts:14`)
đều **không có** `.min(1)`. Nên `{ "note": "" }` và `{ "note": "   " }` đều hợp lệ và ghi
**chuỗi rỗng** vào DB, khác `null`. Comment ngay trên schema nói mục đích là để `"   "` không
lọt vào DB — nhưng kết quả là `""` chứ không phải `null`.

**Hệ quả.** Client phải xử lý **ba** trạng thái (`null`, `""`, có nội dung) thay vì hai, và
"xóa ghi chú" có hai cách làm ra hai giá trị khác nhau.

**Cách sửa.** `.transform((v) => (v === '' ? null : v))` sau `.trim()`, hoặc `.min(1)` để từ
chối thẳng. Phải sửa **cả hai feature cùng lúc**, nếu không lại lệch nhau. Thêm test cho
`PUT /body-logs/:date`, `POST /meals`, `PATCH /meals/:id` — hiện **chưa ca nào được bao phủ**.

Nguồn: `features/body-logs/PLAN.md` §4.3, `features/meals/PLAN.md` §4.3.

### D3. `updatedAt` bị bump khi `PATCH /meals/:id` không đổi gì

**Vấn đề.** `updateMealById` gọi `prisma.meal.updateMany` vô điều kiện, kể cả khi `data` toàn
`undefined` (`repositories/meals.repository.ts:73-82`). Prisma vẫn phát lệnh UPDATE và
`@updatedAt` ghi lại thời điểm hiện tại. `PATCH` với body `{}` — hoặc body lặp lại đúng giá trị
cũ — vẫn dời `updatedAt`.

**Vì sao chưa ai thấy.** Không màn hình nào hiển thị `updatedAt`. Sẽ sai **ngay khi** trang Hôm
nay render "sửa lần cuối lúc…": mở form rồi bấm Lưu mà không sửa gì cũng làm mốc nhảy.

**Cách sửa.** Ở service: `Object.keys(input).length === 0` thì đọc bằng `findMealById` rồi trả
luôn. Trường hợp gửi giá trị **trùng** giá trị cũ vẫn còn — xử lý triệt để phải so sánh với bản
ghi hiện tại trước khi ghi, đắt hơn nhiều và có lẽ không đáng. **Chưa có test nào bao phủ PATCH
body rỗng — viết test trước khi sửa.**

Nguồn: `features/meals/PLAN.md` §4.1.

### D4. Thiếu test cho vài ranh giới của `body-logs`

Không cái nào là bug đã biết; đều là mệnh đề đúng nhưng **chưa có ai canh giữ**:

- Ranh giới `MAX_NOTE_LENGTH`: 1000 ký tự pass / 1001 trả `400`
- `.trim()` của `note` thực sự cắt khoảng trắng trước khi lưu
- `createdAt`/`updatedAt` có mặt và đúng dạng ISO 8601 trong response
- `updatedAt` **thay đổi** còn `createdAt` **giữ nguyên** sau lần `PUT` thứ hai — đây là mệnh đề
  duy nhất chứng minh cột `@updatedAt` của Prisma hoạt động
- Ranh giới `MAX_RANGE_DAYS` — xem D1
- `PUT` **không kèm body**. Express 5 để `req.body` là `undefined`,
  `strictObject.parse(undefined)` sẽ ném `ZodError` → `400`. **Suy ra từ code, chưa xác minh
  bằng test** — cần chạy thật để chốt.

Nguồn: `features/body-logs/PLAN.md` §4.4.

### D5. Hạn chế "không gửi bù" chưa hiện trên giao diện

Spec §7 (`2026-08-06-original-design.md:305`) và §8 (`:320`) đều yêu cầu nói rõ với người dùng rằng nhắc nhở
chỉ chạy khi server bật và **không có gửi bù**. Hiện mới có ở hai chỗ: log console lúc khởi
động (`server/src/server.ts:17`) và `README.md`. **Trang Cài đặt bắt buộc phải hiển thị dòng
này** — thuộc phạm vi feature `web-settings`, chưa làm vì `web/` chưa tồn tại.

Nguồn: `features/reminders/PLAN.md` §5.2.

### D6. `Meal.note` không giới hạn độ dài — **có điều kiện**

`BodyLog.note` có `max(1000)`, `Meal.note` thì không. Hợp lệ với bối cảnh localhost một người:
không có kẻ tấn công nào để nhồi chuỗi 10 MB. **Nếu mở ra LAN hoặc cloud, siết `max()` cùng lúc
với việc thêm auth** — cả hai đều là hệ quả của việc đổi mô hình tin cậy, đừng làm rời nhau.

*Ảnh hưởng của quyết định auth/rbac: **điều kiện đang tiến tới chỗ được thỏa**.* "Mô hình tin cậy
sẽ đổi" không còn là giả thiết — nó là việc đã lên kế hoạch. Mục này vẫn có điều kiện (chưa
implement gì), nhưng nên xếp vào cùng đợt với `auth` chứ không để trôi.

Nguồn: `features/meals/PLAN.md` §4.6, `features/meals/SPEC.md` §4.4; ghi chú bổ sung 2026-08-07.

### D7. `asRecord()` có nhánh chết — dọn dẹp, ưu tiên thấp

`asRecord` (`features/body-logs/dtos/bodyLogs.request.ts:44-48`) trả `{}` cho input không phải
object thuần, nhưng nó chỉ được gọi **sau** khi `upsertBodyLogSchema.parse()` đã thành công —
phép parse đó đã loại mọi thứ không phải object. Nhánh phòng thủ không bao giờ chạy. Vô hại:
giữ thì an toàn nếu ai đó đảo thứ tự hai dòng, xóa thì bớt một hàm. Không gấp.

Nguồn: `features/body-logs/PLAN.md` §4.6.

---

## Những thứ trông như câu hỏi mở nhưng KHÔNG phải

Ghi lại để không ai "sửa cho hợp lý" thứ đang đúng:

- **`GET /api/summary` không bao giờ trả `days` rỗng.** Spec §9 viết "mảng rỗng khi DB rỗng";
  code trả mảng **đầy đủ độ dài với các trường `null`/`0`**. Lệch có chủ ý, để web vẽ trục thời
  gian trực tiếp. `features/summary/PLAN.md` §4.4.
- **`GET /api/goal` không trả `404` khi chưa đặt mục tiêu.** Đừng "sửa cho nhất quán" với
  `body-logs`. `features/goal/PLAN.md` §5.
- **`Goal.targetDate` cho phép ngày tương lai.** Đừng đổi sang `pastOrTodayDateString`.
- **Bất đối xứng `strictObject` (body) vs `z.object` (query).** Đầu vào **ghi** thì nghiêm vì gõ
  sai làm mất dữ liệu âm thầm; đầu vào **đọc** thì rộng vì query thừa không gây hại.
  `features/body-logs/PLAN.md` §4.5.
- **`updateMealById` là hai truy vấn ngoài transaction.** SQLite, localhost, một tiến trình ghi.
  Xem lại **nếu** đổi sang Postgres hoặc mở nhiều client. `features/meals/PLAN.md` §4.4.
  *(2026-08-07: chữ "nếu" nay có ngày. Quyết định thêm auth cho nhiều người dùng làm điều kiện
  "mở nhiều client" thành chuyện sẽ xảy ra — mục này vẫn đúng với bản đang chạy, nhưng đừng dùng
  nó làm lý do để khỏi xem lại khi `auth` xong.)*
- **Không có ràng buộc chống trùng bữa ăn.** Ăn hai bát phở là hai bữa.
  `features/meals/PLAN.md` §4.5.
- **`note` không xuất hiện trong `GET /api/summary`.** Dashboard hiện xu hướng, không hiện ghi
  chú. `features/summary/PLAN.md` §4.6.
