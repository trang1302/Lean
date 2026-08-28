# Feature `meals` — Trạng thái triển khai

Liên quan: [`SPEC.md`](SPEC.md) (hành vi API, quyết định thiết kế, cách ly `userId`).

---

## 1. Trạng thái: ĐÃ XONG

**38/38 test pass.** Toàn bộ 4 endpoint đã triển khai, validate đầy đủ, cách ly `userId` đã có ở tầng repository.

Phân bố test trong `server/test/features/meals/meals.controller.test.ts`:

| Nhóm | Số test | Dòng |
|---|---|---|
| `GET /api/meals` | 7 | `51-121` |
| `POST /api/meals` | 14 | `123-275` |
| `PATCH /api/meals/:id` | 13 | `277-413` |
| `DELETE /api/meals/:id` | 4 | `415-453` |
| **Tổng** | **38** | |

Test dùng ngày cứng `DAY = '2026-08-01'` thay vì `todayIso()` (`meals.controller.test.ts:10-16`): `pastOrTodayDateString` so với hôm nay theo `Asia/Ho_Chi_Minh`, nên một ngày cứng trong quá khứ luôn hợp lệ còn "hôm nay" thì phụ thuộc đồng hồ máy chạy test. Riêng hai test về ngày tương lai buộc phải dùng `addDays(todayIso(), 1)` (dòng `242`, `401`).

Dữ liệu nền dựng thẳng qua Prisma bằng `seedMeal()` (dòng `30-49`), không đi qua API đang test — để test `GET` không phụ thuộc vào `POST` còn đúng hay không.

## 2. File đã tạo

Bốn lớp, mỗi lớp một trách nhiệm. Chiều phụ thuộc luôn đi xuống: controller → service → repository, dtos dùng chung.

| Lớp | File | Vai trò |
|---|---|---|
| Entry | `server/src/features/meals/index.ts` | Tạo `Router`, gọi `registerMealsRoutes`. Export `mealsRouter` cho `app.ts:22` cắm ở `/api/meals`. Giữ nguyên tên export này. |
| Controller | `server/src/features/meals/controllers/meals.controller.ts` | Ánh xạ HTTP ↔ service. Parse Zod, chọn mã trạng thái (`201`, `204`). **Không** try/catch — Express 5 tự đẩy lỗi sang `errorHandler`. Không chứa logic nghiệp vụ. |
| DTO — request | `server/src/features/meals/dtos/meals.request.ts` | 4 schema Zod (`listMealsQuery`, `createMeal`, `updateMeal`, `mealIdParam`) + type suy ra. Nơi duy nhất định nghĩa "input thế nào là hợp lệ". |
| DTO — response | `server/src/features/meals/dtos/meals.response.ts` | `MealResponse` + `toMealResponse`. Lọc `userId`, map `Date` → ISO **theo từng trường**. Biên giới giữa hình dạng DB và hình dạng API. |
| Service | `server/src/features/meals/services/meals.service.ts` | Nghiệp vụ: gán `currentUserId()`, dịch "repository trả `null`/`false`" thành `AppError.notFound`. Không biết gì về HTTP, không đụng `prisma`. |
| Repository | `server/src/features/meals/repositories/meals.repository.ts` | **Nơi duy nhất trong feature được đụng `prisma`.** 4 hàm, mọi `where` đều mang `userId`. Khai `MealRecord` tay để tầng trên không phụ thuộc `src/generated/prisma`. |
| Test | `server/test/features/meals/meals.controller.test.ts` | 38 test qua supertest, đi hết chuỗi controller → service → repository → SQLite thật. |

Nền dùng chung (đã có sẵn, feature này chỉ tiêu thụ):

- `server/src/shared/validation/commonSchemas.ts` — `dateString`, `pastOrTodayDateString`, `slotSchema`, `mealNameSchema`, `caloriesSchema`
- `server/src/shared/errors/AppError.ts`, `errorHandler.ts` — `AppError.notFound` → `404`; `ZodError` → `400` kèm `fields`
- `server/src/lib/time.ts` — `todayIso()` theo `Asia/Ho_Chi_Minh`
- `server/prisma/schema.prisma:37-49` — model `Meal`, index `@@index([userId, date])` phục vụ `findMealsByDate`

## 3. Lệnh verify

Chạy từ `server/`. Test dùng DB riêng do `vitest.config.ts` quyết định — mặc định `file:./test.db`, **không bao giờ** là `data.db` (`test/globalSetup.ts:22-24` chặn cứng).

```bash
cd server

# Chỉ suite meals, DB riêng để không giẫm lên suite khác chạy song song
DATABASE_URL=file:./test-meals.db npx vitest run test/features/meals

# Toàn bộ test
npm test

# Kiểm type, không sinh file
npm run typecheck        # = tsc --noEmit
```

Trên PowerShell, biến môi trường viết khác:

```powershell
cd server
$env:DATABASE_URL = 'file:./test-meals.db'; npx vitest run test/features/meals
```

`vitest.config.ts` đặt `fileParallelism: false` — các file test chạy tuần tự vì cùng dùng một file SQLite và `beforeEach` gọi `deleteMany()` trên mọi bảng.

## 4. Việc còn treo / nợ kỹ thuật

Xếp theo mức độ có thể cắn trở lại.

### 4.1 `updatedAt` bị bump kể cả khi PATCH không đổi gì — **thiếu sót**

`updateMealById` gọi `prisma.meal.updateMany` vô điều kiện, kể cả khi `data` toàn `undefined` (`repositories/meals.repository.ts:73-82`). Prisma vẫn phát lệnh UPDATE, và `@updatedAt` ở `prisma/schema.prisma:46` ghi lại thời điểm hiện tại. Kết quả: `PATCH /api/meals/:id` với body `{}` — hoặc với body lặp lại đúng giá trị cũ — vẫn dời `updatedAt`.

Hôm nay chưa ai thấy vì không màn hình nào hiển thị `updatedAt`. Nó sẽ sai ngay khi trang Hôm nay render "sửa lần cuối lúc …": mở form rồi bấm Lưu mà không sửa gì cũng làm mốc thời gian nhảy.

Cách sửa nếu cần: ở service, `Object.keys(input).length === 0` thì đọc bản ghi bằng `findMealById` rồi trả luôn, không gọi `updateMealById`. Vẫn còn trường hợp gửi giá trị trùng với giá trị cũ — muốn xử lý triệt để thì phải so sánh với bản ghi hiện tại trước khi ghi, đắt hơn nhiều và có lẽ không đáng.

**Chưa có test nào bao phủ PATCH body rỗng.** Nếu sửa, thêm test trước.

### 4.2 `GET /?date=` sắp theo `createdAt`, không theo thứ tự bữa — **lựa chọn, cần xác nhận lại khi làm UI**

`repositories/meals.repository.ts:37` sắp `createdAt: 'asc'` — thứ tự người dùng đã nhập.

Lý lẽ của lựa chọn hiện tại: người dùng ghi bữa ngay sau khi ăn, nên thứ tự nhập thường trùng thứ tự thời gian trong ngày, và danh sách "y như lúc tôi gõ vào" là thứ dễ đối chiếu nhất.

Lý lẽ ngược lại: trang Hôm nay nhiều khả năng muốn nhóm theo buổi `breakfast → lunch → dinner → snack`. Ai đó ghi bù bữa sáng vào buổi tối sẽ thấy bữa sáng nằm cuối danh sách.

Chưa quyết vì trang Hôm nay chưa dựng. Khi dựng, chọn một trong hai:

- Sắp ở frontend theo một mảng thứ tự `slot` — server giữ nguyên hợp đồng hiện tại;
- hoặc đổi `orderBy` ở server. **Lưu ý:** `slot` là `String` trong SQLite (`prisma/schema.prisma:41`) nên `orderBy: { slot: 'asc' }` cho ra thứ tự bảng chữ cái `breakfast, dinner, lunch, snack` — sai. Phải sắp trong bộ nhớ theo mảng thứ tự tường minh.

Không có test nào khóa thứ tự hiện tại (test dòng `62-65` `.sort()` trước khi so sánh) — nên đổi được mà không phá test, nhưng cũng có nghĩa hợp đồng này chưa được bảo vệ.

### 4.3 `note` toàn khoảng trắng thành chuỗi rỗng, không thành `null` — **thiếu sót nhỏ**

`noteSchema` (`dtos/meals.request.ts:14`) trim nhưng không có `.min(1)` sau đó, nên `note: "   "` lưu thành `""`. Comment ngay trên schema nói mục đích là để `"   "` không lọt vào DB, nhưng kết quả là `""` chứ không phải `null` — client giờ phải xử lý ba trạng thái (`null`, `""`, có nội dung) thay vì hai.

Sửa: `.transform((v) => (v === '' ? null : v))` sau `.trim()`. Thêm test cho cả POST và PATCH.

### 4.4 `updateMealById` là hai truy vấn không nằm trong transaction — **chấp nhận được**

`updateMany` rồi `findFirst` (`repositories/meals.repository.ts:73-85`). Nếu bản ghi bị xóa xen giữa hai lệnh, hàm trả `null` → client nhận `404` dù update đã ghi thành công.

Không sửa: SQLite, localhost, một người dùng, một tiến trình ghi. Bọc `$transaction` chỉ thêm chi phí cho một tình huống không tồn tại. **Ghi lại đây vì nếu đổi sang Postgres hoặc mở nhiều client thì phải xem lại.** Đừng vì lý do này mà quay về `findFirst` + `update` — xem `SPEC.md` §6, đánh đổi đó tệ hơn nhiều.

### 4.5 Không có ràng buộc chống trùng — **có chủ đích**

Không có unique index nào trên `(userId, date, slot, name)`. Ghi hai lần cùng một món trong cùng buổi tạo ra hai bản ghi.

Đúng: ăn hai bát phở là hai bữa. Chống trùng ở tầng dữ liệu sẽ chặn cả trường hợp hợp lệ. Nếu muốn giúp người dùng tránh bấm Lưu hai lần, đó là việc của UI (disable nút khi đang gửi), không phải của DB.

### 4.6 `note` không giới hạn độ dài — **có chủ đích, có điều kiện**

Xem `SPEC.md` §4.4. Hợp lệ với bối cảnh localhost một người. **Nếu mở ra LAN hoặc cloud, siết `max()` cho `note` cùng lúc với việc thêm auth** — cả hai đều là hệ quả của việc thay đổi mô hình tin cậy.

### 4.7 Chưa có test đo hiệu năng khi một ngày có rất nhiều bữa — **không cần**

`@@index([userId, date])` đã có. Một ngày thực tế có 3–8 bữa. Không có gì để tối ưu.

## 5. Việc feature khác phụ thuộc vào đây

`summary` đọc bảng `Meal` để tính `totalCalories` và `mealCount` theo ngày, cùng `avgCalories` theo tuần. Nó **không** gọi qua HTTP và không import repository của `meals` — có repository riêng.

Hệ quả cần nhớ: đổi hình dạng `MealResponse` không ảnh hưởng `summary`, nhưng **đổi cột trong `prisma/schema.prisma` thì ảnh hưởng cả hai**. Cụ thể, quy tắc "trung bình calo tuần bỏ qua ngày không ghi bữa nào" (`CLAUDE.md`, Cạm bẫy đã biết) được thực thi ở `summary`, không phải ở đây — feature này không bao giờ tự sinh ra bản ghi 0 calo cho ngày trống.
