# Design — Bỏ chức năng nhắc nhở / thông báo ntfy

> **Đây là tài liệu delta, không phải spec thay thế.** Nó ghi việc **gỡ bỏ** một chức năng
> đã chạy xong, nên nguồn mô tả hành vi cũ là
> [`../../features/reminders/SPEC.md`](../../features/reminders/SPEC.md) và `PLAN.md` cùng
> thư mục — hai file đó sẽ bị chuyển vào `docs/archive/` như một phần của chính việc này.
>
> Ngày chốt: **2026-09-08**. Trạng thái: đã duyệt design, **chưa có dòng code nào bị xóa**.

Mọi tham chiếu `đường-dẫn:dòng` trỏ tới nội dung tại thời điểm 2026-09-08.

---

## 1. Yêu cầu gốc

Nguyên văn của chủ dự án:

> *"bỏ chức năng bắn thông báo đi"*

Bối cảnh: câu này đến ngay sau khi bàn về deploy, nơi ràng buộc *"scheduler node-cron nằm
trong tiến trình nên server phải chạy 24/7"* được nêu ra như một trong bốn điều kiện cứng
giới hạn lựa chọn hạ tầng. Xem §10.

## 2. Ba quyết định đã chốt

Ba câu hỏi được đặt ra trước khi thiết kế, và câu trả lời quyết định toàn bộ phần còn lại:

| # | Câu hỏi | Quyết định |
|---|---------|------------|
| 1 | "Bỏ" sâu tới đâu? | **Xóa sạch, kể cả bảng DB.** Không giữ lại code, UI, quyền, hay model `Reminder` |
| 2 | Ai động vào `server/data.db`? | **Không backup, agent tự chạy `prisma db push`.** Chủ dự án cấp phép tường minh |
| 3 | Xử lý tài liệu thế nào? | **Chuyển vào `docs/archive/`** kèm mục đảo quyết định có ngày ở `00-goals-and-scope.md` |

Quyết định #2 **ghi đè tường minh** luật `NEVER đụng vào server/data.db` ở `CLAUDE.local.md`.
Ghi lại ở đây vì đó là ngoại lệ một lần cho đúng việc này, **không phải** tiền lệ chung.
Hệ quả đã được nêu và chấp nhận: cấu hình giờ nhắc + ntfy topic mất vĩnh viễn, không có
đường lùi.

## 3. Điểm lan xa nhất: ma trận quyền 10 → 8

Thứ tốn công nhất **không phải** thư mục `features/reminders/`, mà là hai mã quyền
`reminder:view` và `reminder:manage`. Chúng là 2 trong 10 quyền của `rbac/SPEC.md §3`, và
**con số 10 bị hard-code ở cả test lẫn tài liệu** — xóa quyền mà quên sửa số là để lại một
đặc tả nói dối.

Sau khi bỏ:

| Trước | Sau |
|-------|-----|
| **10 quyền** tổng | **8 quyền** tổng |
| **6 quyền dữ liệu** (`log:*`, `goal:*`, `reminder:*`) | **4 quyền dữ liệu** (`log:*`, `goal:*`) |
| 3 vai trò | 3 vai trò — **không đổi** |

Ba vai trò `USER` / `ADMIN` / `SYSTEM_ADMIN` giữ nguyên. Chỉ tập quyền của chúng hẹp lại.

**`sequence` để lại lỗ hổng 50 và 60** (`rbac.seed.ts:26-27`). Cố ý không đánh số lại:
`sequence` chỉ quyết định thứ tự hiển thị trên màn Phân quyền, lỗ hổng vô hại, còn đánh số
lại là phải sửa cả hàng đã tồn tại trong `data.db` mà chẳng mua được gì.

## 4. Phạm vi xóa

### 4.1 Xóa hẳn file

| Nơi | File | Số lượng |
|-----|------|----------|
| Server | `src/features/reminders/**` (index, controller, 2 dto, repository, service, scheduler) | 7 |
| Server | `src/shared/clients/ntfy.client.ts` — kiểm tra `shared/clients/` có rỗng sau đó không | 1 |
| Test | `test/features/reminders/**` (controller, scheduler, scheduler.multiUser) | 3 |
| Web | `features/settings/components/`: `ReminderCard.{tsx,module.css,test.tsx}`, `ReminderSettingsSection.{tsx,module.css}`, `NtfyHelp.{tsx,module.css}`, `SchedulerLimitationNotice.{tsx,module.css,test.tsx}` | 10 |
| Web | `features/settings/hooks/useReminderSettings.ts` | 1 |

### 4.2 Sửa tại chỗ

| File | Chỗ sửa |
|------|---------|
| `server/src/app.ts` | :13 import, :117 gắn router `/api/reminders` |
| `server/src/server.ts` | :14 import, :42 `startReminderScheduler()`, :64 `stopReminderScheduler()` |
| `server/src/config/env.ts` | :6 và :16 — `NTFY_BASE_URL` |
| `server/src/shared/rbac/permissionRegistry.ts` | :63-64 — 2 dòng route |
| `server/prisma/seed/rbac.seed.ts` | :26-27 (`PERMISSIONS`), :39-40 (`DATA_PERMISSIONS`), comment "10 quyền" ở :20 |
| `server/prisma/schema.prisma` | :53 quan hệ ngược ở `model User`, :173-185 `model Reminder` |
| `web/.../settings/api/settings.types.ts` | :41-78 — `REMINDER_KINDS`, `ReminderKind`, `ReminderView`, `UpdateReminderInput` |
| `web/.../settings/api/settings.api.ts` | :130-157 xóa `fetchReminders` / `buildReminderPatch` / `updateReminder`; :18-20 bỏ 3 type import; :8-9 và :45-46 là **comment** — xem cảnh báo ngay dưới bảng |
| `web/.../settings/api/settings.api.test.ts` | :55-95 — 2 khối describe cho `buildReminderPatch` / `updateReminder` (khối `updateGoal` bắt đầu ở :96, giữ nguyên) |
| `web/.../settings/components/SettingsPage.tsx` | :12 import, :27 render khối Nhắc nhở |
| `web/.../settings/components/SettingsPage.test.tsx` | :20-21 quyền, :49-51 `DEFAULT_REMINDERS`, :58-61 và :161 mock `/reminders` |
| `web/src/router/routes.test.tsx` | :54-55 — 2 mã quyền |
| `web/src/components/ui/Switch.tsx` | :11 — comment trỏ tới `docs/features/reminders/SPEC.md`, sẽ gãy sau khi archive |

> **Cạm bẫy ở `settings.api.ts`:** `textInputToPatchValue` (:45-46) là hàm **dùng chung** —
> khối Mục tiêu gọi nó cho ô "ngày đích". Hàm này **ở lại**; chỉ sửa comment đang lấy
> `ntfyTopic` làm ví dụ. Xóa nhầm hàm là gãy luôn khối Mục tiêu, và test của nó
> (`settings.api.test.ts:40-54`) sẽ bắt được — nhưng chỉ khi không xóa nhầm cả test.

## 5. Lược đồ dữ liệu

Xóa `model Reminder` (`schema.prisma:173-185`) và quan hệ ngược ở `model User`
(`schema.prisma:53`). Bốn model dữ liệu còn lại — `BodyLog`, `Meal`, `Goal`, `Session` —
**không đụng tới**.

Ba việc phải làm trên `server/data.db`, theo đúng thứ tự:

1. `npx prisma db push` — drop bảng `Reminder` cùng toàn bộ hàng trong đó.
2. Xóa các hàng `RolePermission` trỏ tới `reminder:view` / `reminder:manage`.
   **Phải trước bước 3** vì `RolePermission` có khóa ngoại tới `Permission`.
3. Xóa 2 hàng `Permission` mang 2 mã đó.

Bước 2 và 3 là dữ liệu, không phải lược đồ — `db push` không tự làm. Bỏ sót chúng thì
`GET /api/permissions` vẫn trả 10 quyền, trong đó 2 quyền không còn route nào để gác.

## 6. Test — giữ ý định, không chỉ giữ màu xanh

9 file test ngoài `test/features/reminders/` có nhắc tới nhắc nhở, nhưng **chúng không test
nhắc nhở** — chúng mượn `/api/reminders` làm route mẫu. Ý định của từng file phải sống sót:

| File | Nó thật sự canh điều gì | Xử lý |
|------|-------------------------|-------|
| `auth/middleware.test.ts:33` | Route dưới `requireAuth` mà không có phiên → 401; 5 route mẫu | Bỏ 1 dòng, còn 4 route. Ý định nguyên vẹn |
| `rbac/permissionGuard.test.ts:32,99` | `USER` qua được cửa quyền dữ liệu; `SYSTEM_ADMIN` không bao giờ 403 | Bỏ 2 dòng route; sửa mô tả "6 quyền"→"4 quyền" (:29), "10 quyền"→"8 quyền" (:93, :234) |
| `rbac/rbac.controller.test.ts:44` | `GET /api/permissions` trả đủ danh mục, sắp theo `sequence` | `toHaveLength(10)` → `toHaveLength(8)` |
| `shared/rbac/permissionRegistry.test.ts:53-54,126-127` | Registry phân giải đúng route → quyền, và danh sách mã đầy đủ | Bỏ 2 dòng route + 2 mã |
| `features/userIsolation.test.ts:157,174` | Dữ liệu người này không rò sang người kia | **Xóa 2 test.** Lớp lỗi vẫn được `bodyLogs`/`meals`/`goal`/`summary` canh — lưới an toàn không thủng |
| `lib/db.test.ts:92-113` | Ràng buộc `@@unique([userId, kind])` của bảng `Reminder` | Xóa nguyên khối describe — bảng không còn thì ràng buộc không còn |
| `bodyLogs` / `meals` / `summary` / `users` controller test | Không liên quan | Chỉ bỏ dòng dọn bảng `Reminder` ở `beforeEach` |

Web: `ReminderCard.test.tsx` và `SchedulerLimitationNotice.test.tsx` xóa cùng component.
`Switch.test.tsx` và `keyboardNavigation.test.tsx` **giữ nguyên** — xem §7.1.

## 7. Hai ngoại lệ có chủ đích

### 7.1 `Switch` được giữ dù thành mồ côi

`ReminderCard.tsx:70` là nơi **duy nhất** dùng `components/ui/Switch`. Xóa nhắc nhở là
`Switch` không còn người dùng.

**Vẫn giữ.** Lý do: `Switch` nằm ở `components/ui/` — tầng design system, không thuộc feature
nào — và `keyboardNavigation.test.tsx` dùng nó làm đối tượng để test điều hướng bàn phím. Xóa
`Switch` là xóa luôn một test khả năng tiếp cận không dính dáng gì tới nhắc nhở.

Đây là code chết có thời hạn, không phải code chết vĩnh viễn: công tắc bật/tắt là thứ giao
diện nào cũng cần lại. Ghi rõ ở đây để lần sau ai thấy nó không người dùng thì biết là cố ý.

### 7.2 `server/.env` do chủ dự án tự sửa

Dòng `NTFY_BASE_URL=` trong `server/.env` **agent không đọc và không sửa được** (deny rule).
Chủ dự án tự xóa. Không xóa cũng không hỏng: sau khi `env.ts` bỏ khai báo, biến thừa trong
`.env` bị bỏ qua im lặng.

`server/.env.example` thì sửa được và phải sửa.

## 8. Tài liệu phải cập nhật

**Chuyển kho:** `docs/features/reminders/{SPEC.md,PLAN.md}` →
`docs/archive/2026-09-08-reminders-da-bo.md`, mở đầu bằng ghi chú vì sao bỏ và ngày bỏ.

**Ghi đảo quyết định** vào `docs/overview/00-goals-and-scope.md`, theo đúng khuôn mà quyết
định auth 2026-08-07 đã dùng (:40, :46): giữ lý do cũ, gạch ngang, ghi ngày và lý do mới.
Đây là lần đảo quyết định **thứ hai** của dự án, và là lần đầu theo hướng *bớt* phạm vi.

**Quét dấu vết** ở các file còn lại. Đáng chú ý:

- `CLAUDE.md` — Project Overview ("nhắc nhở qua ntfy"), Tech Stack ("Thông báo: ntfy.sh"),
  cây thư mục (`reminders`, `ntfy.client.ts`), mục Cạm bẫy ("Nhắc nhở chỉ chạy khi server
  bật"), và tham chiếu dự án `Todo` (lấy pattern ntfy, scheduler)
- `docs/README.md:52` — bảng trạng thái feature, và số test sẽ đổi
- `docs/features/rbac/SPEC.md` — 5 chỗ ghi "10 quyền" / "mười quyền" (:31, :56, :579, :616, :622)
- `docs/overview/00-goals-and-scope.md:54` — "ba vai trò và mười quyền"
- `docs/features/web-settings/{SPEC,PLAN}.md` — **nặng nhất trong nhóm này.** Nhắc nhở chiếm
  §4 (Nhóm 2 — Nhắc nhở), §5 (cảnh báo "chỉ chạy khi server bật"), §6 (cảnh báo `ntfyTopic`
  rỗng), §7 (nút "Gửi thử" bị chặn), §8 (ngữ nghĩa `PUT /api/reminders/:kind`), §9 (hướng dẫn
  ntfy) — **6 trong 10 mục**. Sau khi bỏ, tài liệu này còn lại đúng phần Mục tiêu; §2 "Vị trí
  và ranh giới" và §10 "Câu hỏi mở" cũng phải đọc lại vì chúng mô tả trang có hai nhóm
- `README.md`, `docs/overview/01-architecture.md`, `02-data-model.md`, `06-open-questions.md`

**Không sửa** `docs/archive/2026-08-06-original-{design,plan}.md` và các file trong
`docs/superpowers/plans/`: chúng là bản ghi lịch sử của thời điểm khác, sửa là làm sai lịch sử.

## 9. Thứ tự thi công và tiêu chí hoàn thành

Năm bước, mỗi bước kết thúc ở trạng thái test xanh:

1. **Server + RBAC cùng một bước.** Gộp vì tách ra thì có khoảng giữa test đỏ: sửa registry
   trước khi xóa route thì registry trỏ vào hư không; xóa route trước thì còn dòng registry thừa.
2. **Test server** — xóa 3 file, sửa 9 file theo §6.
3. **Web** — xóa 11 file, gọt `settings.api.ts` / `settings.types.ts`, sửa `SettingsPage`.
4. **DB** — `schema.prisma`, rồi `db push`, rồi dọn 2 bảng dữ liệu theo §5.
5. **Tài liệu** — theo §8.

**Tiêu chí hoàn thành** (mọi khẳng định phải kèm output thật):

- `cd server && npm test` xanh
- `cd server && npm run typecheck` sạch
- `cd web && npm test` xanh
- `cd server && npm run build` và `cd web && npm run build` đều qua
- BE khởi động **không còn** dòng "Nhắc nhở: đang chạy…"
- `GET /api/permissions` trả đúng **8** quyền
- Quét `ntfy` / `reminder` trong `server/src` và `web/src` chỉ còn `Switch` (theo §7.1)
- Không còn file tài liệu nào mô tả chức năng như đang chạy

## 10. Hệ quả ngoài phạm vi: deploy

Scheduler `node-cron` chạy trong tiến trình là **một trong bốn ràng buộc cứng** từng được nêu
khi bàn hạ tầng. Bỏ nó là gỡ ràng buộc *"phải chạy 24/7"*. Ba ràng buộc còn lại **không đổi**:

1. SQLite là file trên đĩa → cần ổ đĩa bền, vẫn loại serverless
2. Cache quyền trong RAM tiến trình → vẫn đúng 1 instance
3. Cookie `secure` ở production → vẫn bắt buộc HTTPS

Nghĩa là: nền tảng ngủ khi rảnh **giờ chấp nhận được**, nhưng cửa serverless vẫn đóng.
Đây chỉ là ghi nhận hệ quả — **không có việc deploy nào nằm trong phạm vi lần này**.

## 11. Cố tình KHÔNG làm

- **Không** thay ntfy bằng kênh thông báo khác. Bỏ là bỏ, không phải đổi nhà cung cấp.
- **Không** giữ lại endpoint rỗng hay quyền "để dành". Route không khai trong
  `permissionRegistry` trả 403 theo mặc định-từ-chối — đó đã là hành vi đúng.
- **Không** đánh số lại `sequence` của các quyền còn lại (§3).
- **Không** đụng tới hai khoản nợ đã ghi ở `00-goals-and-scope.md:56` (audit log, cache quyền
  đa tiến trình). Chúng độc lập với việc này.
- **Không** dọn dẹp hay refactor code xung quanh ngoài đúng những chỗ liệt kê ở §4.
