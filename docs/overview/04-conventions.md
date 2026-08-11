# Quy ước và ràng buộc chung

File này trả lời: **những luật áp dụng cho mọi feature** — phiên bản stack, phân lớp, `userId`, ngày tháng, hình dạng lỗi API, và bảng ràng buộc validate. Tài liệu từng feature không lặp lại các mục này, chỉ trỏ về đây.

Liên quan: [`01-architecture.md`](01-architecture.md) (cây thư mục và lý do) · [`02-data-model.md`](02-data-model.md) (bảng, khóa) · [`03-stats.md`](03-stats.md) (công thức chi tiết).

---

## Global Constraints

Áp dụng cho **mọi task**, không lặp lại trong từng task:

- **Phiên bản: luôn dùng bản mới nhất.** Đang chạy Express **5** · TypeScript **7** · Prisma **7** · Zod **4** · node-cron **4** · Vitest **4** · React **19** · Vite **8** · Recharts **3**. Ba hệ quả bắt buộc nhớ:
  - **Prisma 7**: `url` không khai trong `datasource` mà ở `prisma.config.ts`; client sinh ra ở `src/generated/prisma` và import **từ đó**, không từ `@prisma/client`; nối DB qua `PrismaBetterSqlite3` adapter; `db push` không còn cờ `--skip-generate`; đường dẫn `file:` tương đối resolve theo `server/` (nơi có `prisma.config.ts`) chứ **không** theo `prisma/` như Prisma ≤ 6 — nên `file:./data.db` là `server/data.db`.
  - **Express 5** bắt lỗi async sẵn trong core — **không** cài `express-async-errors`, không tự bọc try/catch để nuốt lỗi.
  - **Zod 4**: format validator lên top-level — `z.url()`, `z.email()`, thay cho `z.string().url()`, `z.string().email()`.
- **Cấu trúc feature-first 4 lớp** (bám quán lệ `upip`): `controller → service → repository → Prisma`, **không ngoại lệ** kể cả CRUD tầm thường. `repositories/` là chỗ duy nhất được import `prisma`.
- **Mọi bảng và mọi truy vấn mang `userId`**, lấy từ hằng `LOCAL_USER_ID` trong `server/src/shared/constants.ts`. Chưa có đăng nhập — nhưng khóa đã là `(userId, date)` để sau này thêm auth không phải migrate lại schema.
- **`date` luôn là chuỗi `"YYYY-MM-DD"`.** Không bao giờ dùng `DateTime`/`Date` cho ngày lịch trong DB hoặc trong API payload. Mọi thao tác ngày đi qua `server/src/lib/time.ts`.
- **Timezone: `Asia/Ho_Chi_Minh`.** Chỉ dùng cho việc xác định "hôm nay"; số học ngày thực hiện trên UTC nên không lệch.
- **`shared/stats/` là hàm thuần** — không import `lib/db.ts`, không import express, không đọc `Date.now()` trực tiếp (nhận `todayIso` làm tham số). Để ngoài `features/` vì MA7 dùng chung bởi `summary` và `goal`.
- **Bản đang chạy chưa có auth, chưa có middleware xác thực** → chỉ được chạy localhost. Đây là **trạng thái hiện tại**, không còn là quy ước vĩnh viễn: quyết định đã đảo ngày 2026-08-07, spec + plan ở `../features/{auth,rbac}/`. Khi làm xong, quy ước sẽ là *enforcement 100% ở tầng middleware, không check quyền rải rác trong controller hay service*.
- **Zod validate mọi input** (body + query + params) tại tầng controller, schema đặt trong `features/<f>/dtos/<f>.request.ts`.
- **MA7 trả `null` khi cửa sổ có dưới 2 giá trị.** Cửa sổ là 7 ngày **lịch** `[d-6, d]`, không phải 7 điểm dữ liệu gần nhất.
- **Tuần bắt đầu thứ Hai.**
- **Commit sau mỗi task**, format `<type>(<scope>): <subject>`.
- Chạy mọi lệnh `npm` của server từ `Lean/server`, của web từ `Lean/web`.

## API — quy ước chung

Tất cả endpoint nằm dưới prefix `/api`. Body và query validate bằng Zod. Lỗi validate trả `400` với danh sách trường sai; không tìm thấy trả `404`.

`PUT /body-logs/:date` và `PUT /goal` là **upsert**: trường vắng mặt = giữ nguyên giá trị cũ, gửi `null` = xóa giá trị.

### Hình dạng lỗi

Spec không định nghĩa phần này; chốt tại đây và áp dụng cho mọi feature:

- `400` → `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": [{ "path": "weightKg", "message": "..." }] } }`
- `404` → `{ "error": { "code": "NOT_FOUND", "message": "..." } }`
- `500` → `{ "error": { "code": "INTERNAL_ERROR", "message": "..." } }`

### Quy tắc validate

| Trường | Ràng buộc |
|---|---|
| `date` | Khớp `^\d{4}-\d{2}-\d{2}$`, là ngày hợp lệ, **không được ở tương lai** |
| `weightKg` | `> 0` và `< 500` |
| `waistCm` | `> 0` và `< 300` |
| `calories` | Số nguyên, `>= 0` và `<= 20000` |
| `name` | Không rỗng sau khi trim, tối đa 200 ký tự |
| `slot` | Thuộc `["breakfast","lunch","dinner","snack"]` |
| `timeOfDay` | Khớp `^([01]\d|2[0-3]):[0-5]\d$` |
| `from`/`to` | Ngày hợp lệ, `from <= to`, khoảng tối đa 730 ngày |

Schema dùng lại được (`dateString`, `dateRange`) đặt ở `server/src/shared/validation/commonSchemas.ts`.

## Naming & style

- Biến/hàm: camelCase · Type/Component: PascalCase · Hằng: UPPER_SNAKE_CASE · File: camelCase + hậu tố chấm (server), PascalCase (React component)
- Indent 2 spaces, single quotes, có semicolon
- Cột DB: camelCase (Prisma tự map)

## Git commit

```
<type>(<scope>): <subject>

Types: feat, fix, docs, style, refactor, test, chore
Ví dụ: feat(stats): add 7-day moving average for weight
```
