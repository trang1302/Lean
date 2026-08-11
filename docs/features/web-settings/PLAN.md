# Feature `web-settings` — Kế hoạch & trạng thái

## 1. Trạng thái: **CHƯA BẮT ĐẦU**

Không có file nào. Thư mục `web/` **chưa tồn tại** trong repo. Backend đã xong và
đã khóa hợp đồng API (208 test pass) — phần việc còn lại thuần là frontend, cộng
một tính năng bị chặn ở phía backend (§2.3).

Đọc `SPEC.md` trước khi làm bước nào. Bốn mục **BẮT BUỘC** ở đó (§5–§8) không
phải gợi ý — cắt mục nào là hỏng feature.

## 2. Phụ thuộc — đọc trước khi ước lượng

### 2.1 CHẶN: `web/` scaffold chưa tồn tại

`ls Lean/web` → không có gì. Chưa có `package.json`, `vite.config.ts`,
`index.html`, `main.tsx`, `App.tsx`, `router/routes.tsx`.

Scaffold là **việc dùng chung của cả ba trang** (`today`, `charts`, `settings`),
không thuộc feature này. Ai làm trước thì làm, nhưng feature này **không chạy
được** trước khi có nó. Cấu trúc đích đã chốt ở
`docs/overview/01-architecture.md:50-63`.

### 2.2 CHẶN: `web/src/lib/apiClient.ts` chưa tồn tại

File dùng chung, cũng ngoài phạm vi feature này. Trang Cài đặt cần nó cung cấp
đúng bốn thứ:

- `baseUrl` trỏ `/api` (dev: Vite proxy sang `http://localhost:3000`).
- `Content-Type: application/json` cho `PUT`/`POST`.
- Ném lỗi có cấu trúc khi status ≥ 400, **giữ nguyên `error.code` và
  `error.fields[]`** (`SPEC.md` §4). Client nào nuốt `fields[]` thì trang này
  không map được lỗi về đúng ô nhập, và mục §8 của SPEC coi như bỏ.
- Không tự retry `PUT` — cài đặt là thao tác ghi, retry mù là nguồn ghi đè khó
  truy.

**Nếu `apiClient.ts` chưa có khi bắt đầu:** viết `settings.api.ts` gọi `fetch`
trực tiếp, để lại `TODO` một dòng, và đổi sang `apiClient` ngay khi file dùng
chung xuất hiện. **Không** tự tạo `lib/apiClient.ts` từ trong feature này — ba
trang sẽ ra ba phiên bản khác nhau.

### 2.3 CHẶN (một phần): nút "Gửi thử" — chặn bởi backend

`POST /api/reminders/:kind/test` **không tồn tại**. Xem `SPEC.md` §7 và
`docs/features/reminders/PLAN.md` §5.1 (bốn điểm cần chốt). Chặn **một tính năng**,
không chặn cả trang: Bước 3–7 dưới đây làm được đầy đủ mà không cần route đó.

Không đoán URL, không implement trước rồi chờ backend theo sau.

### 2.4 Không chặn

- **Backend đã sẵn sàng.** `GET`/`PUT /api/goal`, `GET /api/reminders`,
  `PUT /api/reminders/:kind` đều đã pass test. Chạy `cd server && npm run dev`
  là gọi thật được.
- **Câu hỏi mở về trần `dailyCalorieTarget`** (`SPEC.md` §10.1) **không chặn**.
  Client không đặt trần riêng, nên số chốt sau này chỉ đổi ở server.

## 3. File dự kiến

Theo `docs/overview/01-architecture.md:58-62` — chia theo trang, 3 thư mục con +
`index.ts`.

| File | Vai trò |
|---|---|
| `web/src/features/settings/api/settings.api.ts` | 4 hàm gọi HTTP: `fetchGoal`, `updateGoal`, `fetchReminders`, `updateReminder`. Chỗ **duy nhất** của feature biết đường dẫn URL. Nơi hiện thực hai phép map biên: `'' → null` (ô trống) và bóc `kind` khỏi body `PUT` reminders (`SPEC.md` §8.2, §8.3) |
| `web/src/features/settings/api/settings.types.ts` | `GoalResponse`, `GoalPatch`, `ReminderView`, `ReminderKind`, `UpdateReminderInput`, `ApiError`. Kiểu chép đúng theo hợp đồng ở `SPEC.md` §3–§4, không suy diễn |
| `web/src/features/settings/hooks/useGoalSettings.ts` | State + load + save cho nhóm Mục tiêu. Không biết `fetch`, chỉ gọi `settings.api.ts` |
| `web/src/features/settings/hooks/useReminderSettings.ts` | Như trên cho nhóm Nhắc nhở. Giữ mảng 2 phần tử theo `kind` |
| `web/src/features/settings/components/SettingsPage.tsx` | Khung trang: tiêu đề, hai khối, trạng thái loading/error toàn trang |
| `web/src/features/settings/components/GoalSettingsSection.tsx` | 3 ô nhập + nút Lưu + hiện `updatedAt` |
| `web/src/features/settings/components/ReminderSettingsSection.tsx` | Lặp 2 `kind`, mỗi cái một `ReminderCard` |
| `web/src/features/settings/components/ReminderCard.tsx` | Công tắc `enabled`, ô `timeOfDay`, ô `ntfyTopic`, nút Lưu, **cảnh báo thiếu topic** (`SPEC.md` §6) |
| `web/src/features/settings/components/SchedulerLimitationNotice.tsx` | Cảnh báo "chỉ chạy khi server bật, không gửi bù" (`SPEC.md` §5). Tách file riêng **có chủ đích**: để nó không bị ai xóa nhầm khi dọn layout |
| `web/src/features/settings/components/NtfyHelp.tsx` | Hướng dẫn ntfy, thu gọn được (`SPEC.md` §9) |
| `web/src/features/settings/index.ts` | `export { SettingsPage }` — bề mặt duy nhất ra ngoài feature |

Không tạo file nào ngoài `web/src/features/settings/` (trừ một dòng đăng ký route
trong `web/src/router/routes.tsx`, thuộc scaffold dùng chung).

## 4. Các bước

Mỗi bước có deliverable kiểm được bằng mắt hoặc bằng lệnh. Làm tuần tự — bước sau
dùng đầu ra bước trước.

### Bước 0 — Chốt trước khi gõ code

Trả lời 2 câu hỏi mở chặn thiết kế UI: **lưu tay hay tự động** (`SPEC.md` §10.3)
và **có hiện `updatedAt`** (§10.4). Kế hoạch dưới đây giả định **lưu tay, nút
riêng cho từng nhóm**.

*Deliverable:* quyết định ghi vào `SPEC.md` §10. Không code gì.

### Bước 1 — Kiểu và tầng API

Viết `settings.types.ts` + `settings.api.ts`. Bốn hàm, không state, không React.

Hai phép map biên **phải nằm ở đây**, không rải trong component:

- ô số / ô topic trống → `null` (không bao giờ `''`, `NaN`, `undefined`)
- body `PUT /reminders/:kind` chỉ mang `timeOfDay` | `enabled` | `ntfyTopic` —
  bóc bỏ `kind` (`.strict()` sẽ trả 400 nếu lọt vào)

*Deliverable:* `npx tsc --noEmit` sạch. Với server đang chạy, gọi thử bằng
`curl`/Postman và đối chiếu response với `SPEC.md` §3–§4.

### Bước 2 — Hook, chỉ đọc

`useGoalSettings` + `useReminderSettings` với `data`, `loading`, `error`. Chưa có
save.

*Deliverable:* render tạm ra `<pre>{JSON.stringify(...)}</pre>` — thấy đúng
`GoalResponse` và **mảng 2 phần tử** reminders ngay cả khi DB trắng
(`SPEC.md` §4).

### Bước 3 — Khối Mục tiêu, đọc + ghi

`GoalSettingsSection`: 3 ô nhập, nút Lưu, hiện `updatedAt`.

*Deliverable, tự kiểm bằng tay:*
- DB trắng → 3 ô trống, **không** có lỗi 404 nào trong console (`SPEC.md` §3)
- nhập `targetWeightKg = 68` → Lưu → F5 → vẫn còn 68
- xóa trắng ô cân nặng → Lưu → F5 → ô trống, và `GET /api/goal` trả
  `targetWeightKg: null` (kiểm bằng DevTools Network — phải thấy `null` thật
  trong request body, không phải khóa bị mất)
- `targetDate = '2027-12-31'` (tương lai) → **200**, không bị chặn
- `targetWeightKg = 0` → 400, thông báo hiện **ngay dưới ô đó** theo
  `error.fields[0].path`

### Bước 4 — Khối Nhắc nhở, đọc + ghi

`ReminderSettingsSection` + `ReminderCard`, lặp theo mảng từ `GET`.

*Deliverable, tự kiểm bằng tay:*
- 2 thẻ, mặc định `weigh_in 07:00` / `meal_log 20:00`, cả hai `enabled: false`
- gạt công tắc `weigh_in` → Lưu → F5 → giữ nguyên bật, và `timeOfDay` **không
  đổi** (chứng minh partial update, `SPEC.md` §8.1)
- topic `"my topic"` → 400 với message *"Topic chỉ gồm chữ, số, gạch ngang và
  gạch dưới"* hiện dưới ô topic
- xóa trắng ô topic → Lưu → request body chứa `"ntfyTopic": null` → sau F5 ô vẫn
  trống (**không** phải 400 vì gửi `''`, `SPEC.md` §8.3)
- ô giờ không sinh ra `"HH:mm:ss"` (`SPEC.md` §8.4)

### Bước 5 — Hai cảnh báo BẮT BUỘC

`SchedulerLimitationNotice` (`SPEC.md` §5) và cảnh báo thiếu topic trong
`ReminderCard` (§6).

*Deliverable:*
- cảnh báo scheduler **luôn hiện**, không nằm trong accordion đóng, đủ ba ý: chỉ
  chạy khi server bật · máy tắt là mất lượt · không gửi bù
- gạt `enabled` sang bật khi topic trống → cảnh báo hiện **ngay lập tức**, trước
  khi bấm Lưu, và nằm trong đúng thẻ của `kind` đó
- điền topic hợp lệ → cảnh báo biến mất
- nút Lưu **không** bị chặn, `enabled` **không** bị tự tắt

### Bước 6 — Hướng dẫn ntfy

`NtfyHelp` với 4 ý ở `SPEC.md` §9, gồm cả cảnh báo "ai biết topic cũng đọc được
thông báo của bạn".

*Deliverable:* đọc hướng dẫn xong, một người chưa từng biết ntfy tự đăng ký được
topic trên điện thoại và nhận được nhắc nhở thật (đặt `timeOfDay` cách hiện tại
2 phút, để server chạy, chờ).

### Bước 7 — Trạng thái rỗng, lỗi, và dọn dẹp

Loading skeleton, lỗi mạng ở mức trang ("không kết nối được server — server đã
chạy chưa?"), disable nút khi đang gửi, phản hồi "Đã lưu".

*Deliverable:* tắt server → mở trang → thấy thông báo lỗi rõ ràng, không phải
màn hình trắng hay `undefined`.

### Bước 8 — (BỊ CHẶN) Nút "Gửi thử"

**Không làm** cho tới khi backend có `POST /api/reminders/:kind/test` và bốn điểm
ở `SPEC.md` §7 đã được chốt. Vòng đầu: không render nút.

## 5. Lệnh verify dự kiến

Chạy từ `C:\Project\WorkSpace\Lean\web` (thư mục sẽ có sau khi scaffold):

```bash
npm run dev        # http://localhost:7173
npm run build      # vite build — phải sạch
npx tsc --noEmit   # kiểm kiểu, không sinh file
```

Cần server chạy song song để trang có dữ liệu, từ `Lean/server`:

```bash
npx prisma db push   # nếu chưa có data.db
npm run dev          # http://localhost:3000
```

Chưa có test tự động cho web. Nếu thêm (Vitest + Testing Library), ba ca đáng viết
trước, đúng ba chỗ dễ hỏng nhất:

1. `''` trong ô topic được map thành `null` trong body request, không phải `''`
2. body `PUT /reminders/:kind` **không** chứa khóa `kind` (`.strict()`)
3. cảnh báo thiếu topic hiện đúng khi `enabled && !topic.trim()`

## 6. Tóm tắt chỗ bị chặn

| Chỗ | Chặn bởi | Ảnh hưởng |
|---|---|---|
| Toàn bộ feature | `web/` scaffold chưa tồn tại | không chạy được bước nào |
| Tầng gọi HTTP | `web/src/lib/apiClient.ts` chưa tồn tại | **chờ `docs/features/web-shell/` Bước 3** — feature đó sở hữu `apiClient.ts`. `web-shell/SPEC.md` §4.1 chốt: mọi lời gọi HTTP đi qua `apiClient`, **không feature nào được gọi `fetch()` trực tiếp**, kể cả tạm. Luật đó thắng mọi phương án tạm ghi ở §2.2 |
| Nút "Gửi thử" | backend thiếu `POST /api/reminders/:kind/test` | bỏ Bước 8, không render nút |
| Trần `dailyCalorieTarget` | chủ dự án chưa chốt con số | **không chặn** — client không đặt trần riêng |
| Lưu tay vs tự động | chưa chốt | chặn thiết kế `useSettings`, quyết ở Bước 0 |
