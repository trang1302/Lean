# Chừa chỗ cho AI (chưa làm)

File này trả lời: **nếu sau này muốn AI ước tính calo từ ảnh bữa ăn thì gắn vào đâu, và vì sao
gắn được mà không phải viết lại.**

> **Không có tính năng nào trong file này tồn tại trong bản hiện tại.** Không có cột ảnh, không
> có route ước tính, không có lệnh gọi Claude API, không có phụ thuộc nào tới nhà cung cấp AI.
> [`00-goals-and-scope.md`](00-goals-and-scope.md) §2 **cố tình loại bỏ** cả AI phân tích ảnh
> lẫn việc lưu ảnh bữa ăn. Đọc mục "Vì sao đã loại bỏ" dưới đây trước khi đề xuất thêm lại.

Liên quan: [`00-goals-and-scope.md`](00-goals-and-scope.md) (phạm vi và lý do loại bỏ) ·
[`02-data-model.md`](02-data-model.md) (bảng `Meal` hiện tại) ·
[`04-conventions.md`](04-conventions.md) (4 lớp, quy tắc validate) ·
[`../features/meals/SPEC.md`](../features/meals/SPEC.md) (hành vi thật của `meals` hôm nay).

---

## 1. Vì sao đã loại bỏ

Hai lý do, xếp theo trọng số:

1. **Sai số.** Ước tính calo từ ảnh lệch ±20–40%. Ảnh không cho biết khối lượng thật, lượng dầu
   mỡ, hay cách chế biến — cùng một đĩa cơm gà có thể chênh nhau 300 kcal mà nhìn y hệt. Với
   một app mà giá trị nằm ở **xu hướng dài hạn**, một nguồn nhiễu ±30% cộng dồn mỗi ngày phá
   đúng thứ app tồn tại để đo.
2. **Chi phí.** Đây là phần duy nhất trong toàn bộ app tốn tiền theo lượt dùng. Mọi thứ còn lại
   chạy trên máy người dùng với chi phí bằng 0.

Nhập tay 3–8 món mỗi ngày, phần lớn là món lặp lại, tốn ít giây hơn là chụp ảnh rồi sửa lại con
số AI đoán sai.

## 2. Nguyên tắc bắt buộc nếu làm

**AI điền sẵn form, người dùng vẫn là người chốt số.**

Đây không phải chi tiết UI mà là ràng buộc thiết kế. Kết quả ước tính **không được ghi thẳng
vào DB**; nó phải đi qua một bước xác nhận hoặc sửa của người dùng. Lý do là mục §1: một con số
sai ±30% mà lọt vào DB không có dấu vết thì sau này không ai phân biệt được đâu là số đo thật,
đâu là số máy đoán. Đó cũng chính là lý do có cột `caloriesSource` ở §3.

## 3. Đường mở rộng — ba bước

### 3.1 Thêm hai cột vào `Meal`

`server/prisma/schema.prisma`, model `Meal`:

```prisma
photoPath      String?   // đường dẫn file ảnh, null nếu nhập tay
caloriesSource String    @default("manual")   // "manual" | "ai"
```

Cả hai đều **thêm được mà không migrate dữ liệu cũ**: `photoPath` nullable, `caloriesSource` có
default. Mọi bản ghi đang có tự động thành `"manual"` — đúng nghĩa.

`caloriesSource` là `String` chứ không phải enum vì provider là SQLite, không hỗ trợ enum
Prisma — cùng lý do khiến `Meal.slot` đang là `String` (xem [`02-data-model.md`](02-data-model.md)).
Tập giá trị hợp lệ khóa ở tầng Zod, giống cách `slot` đang làm trong
`server/src/features/meals/dtos/meals.request.ts`.

Hệ quả phải nhớ: thêm cột vào `Meal` là **đụng cả `summary`** — feature đó đọc trực tiếp bảng
`Meal` bằng repository riêng (`docs/features/meals/PLAN.md` §5). Hai cột mới không nằm trong
`select`/`groupBy` của `summary` nên không gây vỡ, nhưng đừng đổi cột đang có.

### 3.2 Thêm route `POST /api/meals/estimate`

Nhận ảnh, gọi Claude API với structured output, trả về một form **đã điền sẵn** — không tạo bản
ghi `Meal` nào. Client hiển thị, người dùng sửa nếu cần, rồi mới `POST /api/meals` như bình
thường.

Ghi rõ để người làm sau không phải đoán:

- Route thuộc feature `meals`, đi đủ 4 lớp `controller → service → repository → Prisma` như mọi
  thứ khác ([`04-conventions.md`](04-conventions.md)). Ở đây `repository` gần như không có việc
  vì route không ghi DB — nhưng client gọi AI **không** đặt trong controller; nó thuộc
  `server/src/shared/clients/`, cạnh `ntfy.client.ts`.
- `POST /api/meals` khi đó nhận thêm `caloriesSource` (mặc định `"manual"` nếu vắng). Đây là
  chỗ duy nhất giá trị `"ai"` được ghi vào DB, và nó chỉ được ghi sau khi người dùng bấm xác
  nhận — xem §2.
- Endpoint gọi mạng ngoài đầu tiên của app ngoài ntfy: cần timeout, và cần một hình dạng lỗi
  phân biệt được "ảnh không đọc được" với "không có mạng" — theo đúng cách
  `sendNtfyNotification` trả `{ sent: false, reason }` thay vì ném lỗi.

### 3.3 Giao diện thêm nút chụp ảnh

Đặt **cạnh** form nhập tay hiện có, không thay thế nó. Nhập tay vẫn là đường mặc định; ảnh là
lối tắt.

## 4. Những gì phải quyết trước, không có sẵn câu trả lời

Ba thứ dưới đây bản hiện tại **chưa chừa chỗ**, phải thiết kế thêm:

| Vấn đề | Vì sao chưa có sẵn |
|---|---|
| Ảnh lưu ở đâu | App hiện không lưu file gì ngoài `data.db`. Thêm ảnh là thêm một thư mục có vòng đời riêng: xóa `Meal` thì ảnh mồ côi, backup không còn là "copy một file" nữa (xem `README.md` mục Sao lưu). |
| API key của nhà cung cấp AI | `server/src/config/env.ts` hiện chỉ có `DATABASE_URL`, `PORT`, `NTFY_BASE_URL`. Rủi ro **đổi bản chất tùy lúc làm**: khi chưa có auth, bất kỳ ai chạm được cổng 3000 sẽ tiêu tiền của bạn qua `POST /meals/estimate`. Khi đã có auth (spec ở `../features/auth/`), rủi ro chuyển thành *người dùng đã đăng nhập tiêu tiền của bạn* — cần hạn mức theo người dùng chứ không phải chỉ khóa cổng. Đây là hai bài toán khác nhau, đừng giải bài cũ rồi tưởng xong. |
| Hiển thị nguồn số liệu | `caloriesSource` chỉ có ý nghĩa nếu giao diện cho thấy được món nào do AI đoán. Nếu không hiện thì cột này chỉ là dữ liệu chết. |

## 5. Điều KHÔNG được làm nhân dịp này

- **Không** biến ước tính AI thành đường mặc định. §2 là ràng buộc, không phải gợi ý.
- **Không** thêm database món ăn dựng sẵn kèm theo. Nó bị loại vì lý do riêng
  ([`00-goals-and-scope.md`](00-goals-and-scope.md) §2), không phải vì thiếu AI.
- **Không** nới `caloriesSchema` (`0–20 000`) để chứa số AI trả về. Nếu AI đoán ra con số ngoài
  khoảng đó thì đó là dấu hiệu ước tính hỏng, đúng ra phải chặn.
