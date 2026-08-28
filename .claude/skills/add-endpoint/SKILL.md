---
name: add-endpoint
description: Use when adding or changing an HTTP endpoint under /api in server/src/routes — e.g. "thêm endpoint X", "sửa route Y", "add PATCH /meals/:id" — to keep Zod validation, date handling, and the pure-stats boundary intact.
---

# Thêm / sửa endpoint `/api`

## Tổng quan

Endpoint đi đủ **4 lớp**, không có ngoại lệ kể cả CRUD tầm thường:

```
controller  nhận request, validate bằng Zod, trả response — không chứa nghiệp vụ
   ↓
service     nghiệp vụ; gọi hàm thuần trong shared/stats/ nếu cần tính toán
   ↓
repository  truy vấn Prisma — chỗ DUY NHẤT được import prisma
   ↓
Prisma
```

Bất kỳ phép tính nào nằm ngoài `shared/stats/` là sai chỗ. Bất kỳ `Date`/`DateTime`
nào chạm vào field `date` là bug múi giờ. Bất kỳ truy vấn nào thiếu `userId` là bug
cách ly dữ liệu — kể cái khi tra theo khóa chính, vì `id` là cuid toàn cục nên `where: { id }` trần chạm được bản ghi của người khác.

## Quy trình

1. **Đối chiếu tài liệu trước.** `docs/features/<tên>/SPEC.md` có bảng route
   thật của feature đó; `docs/overview/04-conventions.md` có bảng ràng buộc
   validate dùng chung. Nếu endpoint bạn định thêm không có trong SPEC →
   **DỪNG**, hỏi tôi trước. Đừng tự phát minh route.

   Đọc luôn mục **"Quyết định vượt spec"** của SPEC đó — nó ghi những lựa chọn
   như mã trạng thái, hình dạng response, có `.strict()` hay không. Endpoint mới
   phải nhất quán với chúng, nếu không cùng một feature sẽ hành xử hai kiểu.

2. **Viết test trước** (`server/test/<resource>.test.ts`, supertest). Tối thiểu
   phải có: happy path, một case validate hỏng → `400`, và `404` nếu route có
   khái niệm "không tìm thấy". Chạy `cd server && npm test`, xác nhận đỏ đúng lý do.

3. **Định nghĩa Zod schema** cạnh route, không rải inline trong handler. Bám
   đúng bảng ràng buộc §5:

   | Trường | Ràng buộc |
   |---|---|
   | `date` | `^\d{4}-\d{2}-\d{2}$`, ngày có thật, **không ở tương lai** |
   | `weightKg` | `> 0`, `< 500` |
   | `waistCm` | `> 0`, `< 300` |
   | `calories` | số nguyên, `0 … 20000` |
   | `name` | trim xong không rỗng, ≤ 200 ký tự |
   | `slot` | `breakfast` \| `lunch` \| `dinner` \| `snack` |
   | `timeOfDay` | `^([01]\d\|2[0-3]):[0-5]\d$` |
   | `from`/`to` | ngày hợp lệ, `from <= to`, khoảng ≤ 730 ngày |

   "Không ở tương lai" so với **hôm nay theo `Asia/Ho_Chi_Minh`**, lấy từ
   `time.ts` — không dùng `new Date()` trần trong route.

4. **Phân biệt PUT-upsert với PATCH.** `PUT /body-logs/:date` và `PUT /goal` là
   **upsert**: trường **vắng mặt** giữ nguyên giá trị cũ, gửi **`null`** mới xóa.
   Zod `.partial()` không phân biệt được hai ca này — phải dùng schema cho phép
   `null` tường minh và kiểm tra bằng `key in body`, không phải `body[key] !== undefined`.
   Có test riêng cho cả hai ca, nếu không sẽ regress.

5. **Không tính toán trong route.** Cần MA7, `currentRate`, `onTrack`,
   `remainingKg`, trung bình tuần → gọi hàm trong `stats.ts`. Chưa có hàm thì
   thêm hàm thuần vào `stats.ts` kèm unit test riêng, rồi mới gọi. Route không
   được nhận biết công thức.

6. **Lỗi trả về đúng hình dạng.** Validate hỏng → `400` kèm **danh sách trường
   sai**, không phải một chuỗi chung chung. Không tìm thấy → `404`. Handler
   async dựa vào `express-async-errors` — đừng tự bọc try/catch để nuốt lỗi.

7. **Đăng ký route** trong `app.ts` dưới prefix `/api`, và cập nhật
   `web/src/api.ts` nếu frontend cần gọi.

8. **Verify** — dán output thật:
   ```bash
   cd server && npm test
   cd server && npx tsc --noEmit
   ```

## Không bao giờ làm

- Đừng lưu `date` dưới dạng `DateTime` trong Prisma hay chuyển qua `new Date()`
  rồi format lại. Chuỗi `"YYYY-MM-DD"` đi thẳng từ request tới DB.
- Đừng để MA7 hay bất kỳ phép trung bình nào sống trong file route.
- Đừng để `PUT` upsert xóa mất trường chỉ vì client không gửi nó.
- Đừng thêm endpoint không có trong §5 mà không hỏi.

## Tra nhanh

| Việc | Chỗ để code |
|---|---|
| Validate | `features/<f>/dtos/<f>.request.ts` (Zod) |
| Hình dạng trả về | `features/<f>/dtos/<f>.response.ts` |
| Nhận request, trả response | `features/<f>/controllers/<f>.controller.ts` |
| Nghiệp vụ | `features/<f>/services/<f>.service.ts` |
| Truy vấn DB | `features/<f>/repositories/<f>.repository.ts` |
| Ngày / múi giờ | `server/src/lib/time.ts` |
| Phép tính | `server/src/shared/stats/` (hàm thuần) |
| Nguồn `userId` | `req.user!.id` — do `requireAuth` gắn, controller truyền xuống service |
| Khai quyền cho route mới | `server/src/shared/rbac/permissionRegistry.ts` — không khai là 403 |
| Đăng ký | `features/<f>/index.ts` export router → `src/app.ts`, prefix `/api` |
