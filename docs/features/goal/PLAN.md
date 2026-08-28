# Feature `goal` — Kế hoạch & trạng thái

## 1. Trạng thái: **ĐÃ XONG**

18 test pass tại `server/test/features/goal/goal.controller.test.ts`. Không còn việc bắt buộc.
Một câu hỏi mở cần chủ dự án chốt — §4.

Phân bố test:

| Nhóm | Số test | Dòng |
|---|---|---|
| `GET /api/goal` | 3 | `goal.controller.test.ts:17-61` |
| `PUT` — tạo và cập nhật | 3 | `:63-102` |
| `PUT` — upsert ba trạng thái | 4 | `:104-166` |
| `PUT` — validate | 8 | `:168-217` |

## 2. File đã tạo

Bốn lớp, mỗi lớp một trách nhiệm, ranh giới không được xuyên qua.

| File | Lớp | Vai trò |
|---|---|---|
| `server/src/features/goal/index.ts` | router | Gom controller vào `goalRouter`; `app.ts:23` cắm ở prefix `/api/goal`, path bên trong tương đối |
| `server/src/features/goal/controllers/goal.controller.ts` | HTTP | `GET /` và `PUT /`. Parse Zod, gọi service, trả JSON. Không try/catch — Express 5 tự đẩy lỗi async sang `errorHandler` (`:18-20`). Truyền **cả body thô lẫn kết quả parse** vào `toGoalPatch` (`:24`) vì sau parse thì mất dấu "vắng mặt vs null" |
| `server/src/features/goal/services/goal.service.ts` | nghiệp vụ | Nhận `userId` từ controller (đã đổi ở giai đoạn A — trước đó là hằng). Map row sang response DTO |
| `server/src/features/goal/repositories/goal.repository.ts` | dữ liệu | **Chỗ duy nhất** của feature import `prisma` (`:1`). `findGoal` theo `userId` (khóa chính), `upsertGoal` với `create`/`update` cùng một `patch` |
| `server/src/features/goal/dtos/goal.request.ts` | DTO vào | `goalUpsertSchema` (Zod, `.partial()` + `.nullable()`) và `toGoalPatch()` — hàm dựng patch ba trạng thái bằng `key in rawBody` |
| `server/src/features/goal/dtos/goal.response.ts` | DTO ra | `GoalRow` (khai lại tại chỗ để DTO không phụ thuộc client Prisma sinh ra, `:1-7`) và `toGoalResponse()` — chỗ hiện thực quy tắc "chưa đặt → object toàn `null`, không 404" |
| `server/test/features/goal/goal.controller.test.ts` | test | 18 test qua supertest trên app thật + DB thật; `beforeEach` xóa sạch bảng `Goal` (`:9-11`) |

Không có file nào của feature này nằm ngoài `server/src/features/goal/` và
`server/test/features/goal/`. Schema `Goal` nằm ở `server/prisma/schema.prisma:51-57`
(dùng chung, không thuộc feature).

Dùng lại từ `shared/`, **không** khai lại:

- `weightKgSchema`, `dateString`, `caloriesSchema` — `server/src/shared/validation/commonSchemas.ts:21,8,23`
- `errorHandler` — `server/src/shared/errors/errorHandler.ts`

## 3. Lệnh verify

Chạy từ `C:\Project\WorkSpace\Lean\server`:

```bash
# 18 test của riêng feature này
npx vitest run test/features/goal/goal.controller.test.ts

# toàn bộ test server
npm test

# kiểm kiểu, không sinh file
npx tsc --noEmit
```

`npm test` map sang `vitest run` và `npm run typecheck` map sang `tsc --noEmit`
(`server/package.json:9,11`).

Test dùng DB thật nên cần schema đã push:

```bash
npx prisma db push
```

## 4. Việc còn treo — trần của `dailyCalorieTarget`

**Đây là câu hỏi mở, cần chủ dự án chốt con số. Không tự quyết.**

`dailyCalorieTarget` đang validate bằng `caloriesSchema`
(`server/src/features/goal/dtos/goal.request.ts:24`):

```ts
export const caloriesSchema = z.number().int().min(0).max(20_000);
// server/src/shared/validation/commonSchemas.ts:23
```

Vấn đề: schema này được spec §5 định nghĩa cho calo của **một bữa ăn**, và `meals` đang dùng
đúng nó cho `calories` của từng bữa. Lấy **trần một bữa làm trần cả ngày** là ràng buộc lỏng
— 20 000 kcal/ngày là con số vô nghĩa về mặt sinh lý, nên trường này thực tế gần như không
được kiểm chặn phía trên.

Chưa sửa vì spec §5 **không định nghĩa luật riêng** cho mục tiêu calo ngày, và tự bịa một
hằng số mới sẽ là quyết định sản phẩm đội lốt quyết định kỹ thuật.

Cần chốt:

1. Trần hợp lý cho mục tiêu calo một ngày là bao nhiêu? (tham chiếu: khẩu phần người trưởng
   thành thường 1 200 – 4 000 kcal/ngày)
2. Sàn có nên lớn hơn `0` không? Hiện `0` được chấp nhận, tức đặt mục tiêu nhịn hoàn toàn.

Khi đã có số, sửa ở **một chỗ**: thêm `dailyCalorieTargetSchema` vào
`shared/validation/commonSchemas.ts` rồi trỏ `goal.request.ts:24` sang schema mới. Không sửa
`caloriesSchema` — `meals` đang phụ thuộc nó với ngữ nghĩa khác.

## 5. Ghi chú cho người sửa sau

Ba chỗ trông như bug nhưng là chủ đích. Đọc `SPEC.md` §3, §4, §5 trước khi đổi:

- `GET` không trả 404 khi chưa đặt mục tiêu — **đừng** "sửa cho nhất quán" với `body-logs`
- `Goal` không có cột `id` — `userId` là khóa chính
- `targetDate` cho phép ngày tương lai — **đừng** đổi sang `pastOrTodayDateString`

Và một chỗ dễ bị "bổ sung cho tiện": `remainingKg` / `onTrack` **không** thuộc feature này.
Chúng ở `server/src/shared/stats/rate.ts:70,55`, phơi ra qua `GET /summary`. Xem `SPEC.md` §7.
