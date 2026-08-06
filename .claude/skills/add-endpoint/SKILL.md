---
name: add-endpoint
description: Use when adding or changing an HTTP endpoint under /api in server/src/routes — e.g. "thêm endpoint X", "sửa route Y", "add PATCH /meals/:id" — to keep Zod validation, date handling, and the pure-stats boundary intact.
---

# Thêm / sửa endpoint `/api`

## Tổng quan

Route trong dự án này chỉ làm ba việc: **validate bằng Zod → lấy dữ liệu từ
Prisma → gọi hàm thuần trong `stats.ts`**. Bất kỳ phép tính nào nằm trong route
là sai chỗ. Bất kỳ `Date`/`DateTime` nào chạm vào field `date` là bug múi giờ.

## Quy trình

1. **Đối chiếu spec trước.** §5 của `2026-08-06-health-tracker-design.md` có
   bảng route và bảng ràng buộc validate. Nếu endpoint bạn định thêm không có
   trong bảng đó → **DỪNG**, hỏi tôi trước. Đừng tự phát minh route.

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
| Validate | Zod schema đầu file route |
| Ngày / múi giờ | `server/src/time.ts` |
| Phép tính | `server/src/stats.ts` (hàm thuần) |
| Truy vấn DB | trong handler, qua `server/src/db.ts` |
| Đăng ký | `server/src/app.ts`, prefix `/api` |
