# Mô hình dữ liệu

File này trả lời: **có những bảng nào, khóa là gì, và vì sao `date` là chuỗi chứ không phải `DateTime`.** Đọc trước khi đổi `server/prisma/schema.prisma`.

Liên quan: [`00-goals-and-scope.md`](00-goals-and-scope.md) (vì sao mọi bảng mang cột `userId`, và trạng thái auth hiện tại) · [`01-architecture.md`](01-architecture.md) (Prisma 7 và vị trí connection string) · [`03-stats.md`](03-stats.md) (dữ liệu này được tính thành gì) · [`04-conventions.md`](04-conventions.md) (ràng buộc validate cho từng trường).

---

## 4. Mô hình dữ liệu

**Mọi bảng mang cột `userId` ngay từ đầu**, từ trước khi có đăng nhập. Giá trị của cột đó nay đến từ phiên (`req.user.id`). Khóa vì thế là **kép**: `BodyLog` dùng `@@id([userId, date])`, `Goal` dùng `userId` làm khóa chính, `Reminder` dùng `@@unique([userId, kind])`.

Lý do làm ngay thay vì để sau: thêm khóa người dùng vào một schema đã có dữ liệu nghĩa là sửa mọi bảng, mọi ràng buộc unique, mọi truy vấn, mọi route, cộng một lần migrate. Khoản đầu tư đó đã được thu hồi: giai đoạn A thay nguồn của `userId` mà **không đổi một khóa nào** của bốn bảng dữ liệu.

**Bước chuẩn bị đó nay đang được dùng tới.** Ngày 2026-08-07 dự án chốt là **sẽ có đăng nhập và phân quyền** ([`00-goals-and-scope.md`](00-goals-and-scope.md) §2). Hình dạng bảng ở trên **không đổi** — đúng như dự tính lúc thêm cột. Trạng thái: **đã xong** (2026-08-28). Bốn bảng dữ liệu thêm đúng một dòng quan hệ `user User @relation(..., onDelete: Cascade)`; `@@id([userId, date])`, `@@unique([userId, kind])` và `Goal.userId` làm khóa chính đều giữ nguyên.

> **Đừng đọc câu "chỉ tốn một cột và một hằng" ở trên thành "thay hằng là xong".**
> Cột thì đúng là không phải đổi. Nhưng grep thực tế cho thấy code chia làm hai nhóm:
>
> | Nhóm | Feature | Việc phải làm |
> |---|---|---|
> | Hằng nằm ở **service**, repository đã nhận `userId` làm tham số | `goal`, `meals` | thay đúng một chỗ |
> | Hằng import thẳng vào **repository** | `bodyLogs`, `summary`, `reminders` | **đổi chữ ký hàm** rồi sửa mọi lời gọi ở service |
>
> Nặng nhất là **scheduler nhắc nhở**: nó chạy theo cron, không có request nên
> không có phiên. `ReminderRunnerDeps` trong `reminders.scheduler.ts` hiện không
> có `userId` ở bất kỳ hàm nào — toàn bộ giả định ngầm là một người dùng, phải
> viết lại chứ không phải thay hằng. Rủi ro cụ thể nếu làm ẩu: vòng lặp sai chỗ
> sẽ gửi nhắc nhở của người này tới topic ntfy của người khác.
>
> Chi tiết và thứ tự làm ở [`../features/auth/PLAN.md`](../features/auth/PLAN.md).

### Các bảng sẽ thêm khi có auth và phân quyền

Sẽ có thêm ít nhất ba bảng. Ở đây **chỉ nêu tên và vai trò** — schema chi tiết (cột, khóa, quan hệ) do feature `auth` và `rbac` chốt, đừng suy diễn từ file này:

| Bảng | Vai trò |
|---|---|
| `User` | Người dùng thật — thứ mà `userId` của bốn bảng dưới đây trỏ tới |
| `Role` | Vai trò được gán cho người dùng |
| `Permission` | Quyền cụ thể, gắn vào vai trò |

Nguồn chân lý: [`../features/auth/SPEC.md`](../features/auth/SPEC.md) và
[`../features/rbac/SPEC.md`](../features/rbac/SPEC.md).

**Bước migrate.** Dữ liệu hiện có mang `userId = 'local'` — một chuỗi tự do, không trỏ tới hàng nào cả. Khi bảng `User` xuất hiện, phải có một bước migrate biến `'local'` thành một `User` thật rồi trỏ mọi bản ghi cũ về đó, **trước khi** bật ràng buộc khóa ngoại. Bỏ qua bước này là mất toàn bộ lịch sử cân nặng và bữa ăn đã ghi. Cách làm cụ thể chưa chốt — xem [`06-open-questions.md`](06-open-questions.md).

Prisma 7 không còn nhận `url` trong `datasource`; connection string nằm ở `prisma.config.ts`.

> **Đã cập nhật so với spec gốc:** khối schema trong §4 của spec vẫn là bản trước khi thêm `userId` (`BodyLog.id` cuid + `date @unique`, `Goal.id = "singleton"`, `Reminder.kind @unique`). Khối dưới đây theo phần chữ của §4 và `CLAUDE.md` — khóa kép có `userId` — và khớp với `server/prisma/schema.prisma` đang chạy.

```prisma
datasource db {
  provider = "sqlite"
}

model BodyLog {
  userId     String
  date       String                     // "YYYY-MM-DD", ngày theo giờ địa phương
  weightKg   Float?
  waistCm    Float?
  chestCm    Float?
  shoulderCm Float?
  armCm      Float?
  note       String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@id([userId, date])
}

model Meal {
  id        String   @id @default(cuid())
  userId    String
  date      String                     // "YYYY-MM-DD"
  slot      String                     // "breakfast" | "lunch" | "dinner" | "snack"
  name      String
  calories  Int
  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, date])
}

model Goal {
  userId             String   @id
  startWeightKg      Float?
  startDate          String?           // "YYYY-MM-DD" — điểm xuất phát, KHÔNG PHẢI DateTime
  targetWeightKg     Float?
  targetWaistCm      Float?
  targetChestCm      Float?
  targetShoulderCm   Float?
  targetArmCm        Float?
  targetDate         String?           // "YYYY-MM-DD"
  dailyCalorieTarget Int?
  updatedAt          DateTime @updatedAt
}

model Reminder {
  id        String   @id @default(cuid())
  userId    String
  kind      String                     // "weigh_in" | "meal_log"
  timeOfDay String                     // "HH:mm", 24 giờ
  enabled   Boolean  @default(false)
  ntfyTopic String?
  updatedAt DateTime @updatedAt

  @@unique([userId, kind])
}
```

### Ghi chú về mô hình

- **`date` lưu dạng chuỗi `"YYYY-MM-DD"`, không dùng `DateTime`.** Đây là lựa chọn có chủ đích: "ngày tôi cân" là một ngày trên lịch, không phải một thời điểm. Lưu `DateTime` sẽ kéo theo lỗi lệch múi giờ (bản ghi lúc 7h sáng giờ Việt Nam bị lưu thành ngày hôm trước theo UTC). Chuỗi ngày loại bỏ hẳn cả nhóm lỗi này.
- **`weightKg`, `waistCm`, `chestCm`, `shoulderCm`, `armCm` đều nullable.** Có ngày chỉ cân mà không đo hết bốn vòng; không nên ép nhập đủ cả năm mới lưu được.
- **`Goal.startDate` là chuỗi `"YYYY-MM-DD"`, không phải `DateTime`** — cùng lý do với `date` của `BodyLog`: đây là một ngày trên lịch (mốc xuất phát của % tiến độ, đợt `charts-mui`), không phải một thời điểm. `targetDate` giữ nguyên lý do tương tự nhưng validate ngược hướng — xem `../features/goal/SPEC.md` §5.
- **`slot` là `String`, ràng buộc bằng Zod ở tầng controller**, không dùng Prisma enum (SQLite không hỗ trợ native enum, và `Todo/` đã đi theo hướng này).
- **`Goal` chỉ có đúng một hàng cho mỗi người dùng**, khóa chính là `userId`, thao tác bằng `upsert`. (Spec gốc mô tả id cố định `"singleton"` — thay bằng `userId` khi thêm khóa người dùng.)
- **`Reminder` unique theo `(userId, kind)`** — mỗi loại nhắc nhở chỉ có một cấu hình cho mỗi người dùng.
