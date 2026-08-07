# Mục tiêu và phạm vi

File này trả lời: **app này để làm gì, và cố tình không làm gì.** Đọc mục "Không có trong bản này" trước khi đề xuất thêm bất cứ tính năng nào — mỗi thứ bị loại đều có lý do đi kèm.

Liên quan: [`01-architecture.md`](01-architecture.md) (cấu trúc và lựa chọn kỹ thuật) · [`02-data-model.md`](02-data-model.md) (mô hình dữ liệu) · [`03-stats.md`](03-stats.md) (logic thống kê) · [`04-conventions.md`](04-conventions.md) (ràng buộc chung khi code).

---

## 1. Mục tiêu

App theo dõi sức khỏe cá nhân chạy trên máy tính, ghi lại hàng ngày:

- Cân nặng và số đo vòng bụng
- Các bữa ăn (tên món + calo, nhập tay)

Và cho biết: xu hướng cân nặng/vòng bụng theo thời gian, lượng calo nạp vào so với mục tiêu, tiến độ so với cân nặng mục tiêu.

**Giá trị cốt lõi không phải là con số chính xác, mà là xu hướng.** Cân nặng dao động 1–2 kg mỗi ngày do lượng nước và thức ăn trong đường tiêu hóa; con số của một ngày riêng lẻ gần như vô nghĩa. Vì vậy mọi biểu đồ cân nặng đều hiển thị kèm trung bình trượt 7 ngày, và đó mới là đường người dùng nên nhìn.

## 2. Phạm vi

### Có trong bản này

| Tính năng | Mô tả |
|---|---|
| Ghi số đo cơ thể | Cân nặng, vòng bụng, ghi chú — 1 bản ghi/ngày |
| Ghi bữa ăn | Tên món + calo tự gõ, phân theo buổi, nhiều bữa/ngày |
| Biểu đồ xu hướng | Cân nặng + vòng bụng theo thời gian, kèm trung bình trượt 7 ngày |
| Thống kê calo | Tổng calo theo ngày, trung bình tuần, so với mục tiêu |
| Mục tiêu cân nặng | Cân nặng đích + hạn, hiển thị tiến độ và tốc độ hiện tại |
| Nhắc nhở | Nhắc cân buổi sáng / ghi bữa ăn, gửi qua ntfy |

### Không có trong bản này

Đây **không phải** danh sách "chưa làm kịp". Mỗi mục dưới đây đã được cân nhắc và loại bỏ có chủ đích; lý do quan trọng hơn bản thân danh sách.

- **AI phân tích ảnh bữa ăn** — đã cân nhắc và loại bỏ để giữ chi phí bằng 0. Kiến trúc chừa chỗ để gắn vào sau (xem §10 của spec gốc).
- **Lưu ảnh bữa ăn** — không lưu file, không upload.
- **Database món ăn dựng sẵn** — người dùng tự gõ calo mỗi bữa.
- **Đăng nhập / nhiều người dùng** — **quyết định này đã đổi ngày 2026-08-07**, xem mục ngay dưới. Lý do loại bỏ ban đầu vẫn giữ nguyên ở đây: chạy localhost, một người.
- **Ứng dụng di động / truy cập từ điện thoại** — chỉ dùng trên máy tính chạy server.

Hai quyết định nền tảng đi kèm phạm vi này, lý do đầy đủ ở [`01-architecture.md`](01-architecture.md):

- **SQLite thay vì Postgres** — một file `data.db`, không cần cài dịch vụ, backup = copy file. Đánh đổi: không chạy được nhiều tiến trình ghi đồng thời — không thành vấn đề với 1 người dùng.
- **Không có đăng nhập** — localhost, một người. Auth chỉ thêm một màn hình phải bấm qua mỗi ngày mà không bảo vệ thêm điều gì. Đánh đổi: nếu sau này mở ra mạng LAN hoặc cloud thì **bắt buộc** phải thêm auth trước. *Điều kiện "sau này" đó đã xảy ra — xem mục kế tiếp. Lý do gốc giữ nguyên ở đây vì nó vẫn đúng với bối cảnh cũ và giải thích vì sao bản đang chạy trông như hiện tại.*

Dù bản đang chạy chưa có đăng nhập, **mọi bảng vẫn mang cột `userId` ngay từ đầu** — xem [`02-data-model.md`](02-data-model.md) để biết vì sao. Đó là bước chuẩn bị, và giờ nó đang được dùng tới.

### Đăng nhập và phân quyền — quyết định đã đổi (2026-08-07)

**Đã đổi.** Chủ dự án nêu hướng phát triển vượt xa bối cảnh một máy — quy mô có thể lên tới hàng chục triệu người dùng — và yêu cầu bổ sung phân quyền. Với nhiều người dùng thật, hai lập luận nền của quyết định cũ ("chỉ có một người", "auth không bảo vệ thêm điều gì") không còn đúng: dữ liệu sức khỏe của người này phải không nhìn thấy được bởi người kia. Vì vậy **đăng nhập và phân quyền nay nằm TRONG phạm vi dự án**.

**Trạng thái: đã có spec + plan, CHƯA implement.** Chưa có dòng code auth nào. Bản đang chạy vẫn là bản không xác thực, mọi bản ghi vẫn mang `userId = 'local'`.

> **Cảnh báo vẫn còn nguyên giá trị:** vì bản hiện tại không có auth, nó **chỉ được chạy trên localhost**. Mở ra mạng LAN hoặc cloud **trước khi** làm xong `auth` và `rbac` là phơi toàn bộ dữ liệu sức khỏe cho bất kỳ ai chạm được tới cổng đó — không cần mật khẩu, không cần thủ thuật gì.

Chi tiết không nằm ở file này. Xem:

- [`../features/auth/SPEC.md`](../features/auth/SPEC.md) — đăng nhập, phiên, người dùng
- [`../features/rbac/SPEC.md`](../features/rbac/SPEC.md) — vai trò và quyền

Những gì kéo theo ở tầng dữ liệu (bảng `User`/`Role`/`Permission`, và việc migrate dữ liệu `userId = 'local'` hiện có) tóm tắt ở [`02-data-model.md`](02-data-model.md); những gì còn chưa chốt nằm ở [`06-open-questions.md`](06-open-questions.md).
