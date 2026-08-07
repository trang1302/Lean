---
description: Nạp quy ước API + logic thống kê của dự án trước khi code
---

Đọc các nguồn sau và xác nhận đã nạp quy ước:

1. `@CLAUDE.md` — mục "Quy ước bắt buộc"
2. `@docs/overview/02-data-model.md` — mô hình dữ liệu
3. `@docs/overview/03-stats.md` — công thức thống kê
4. `@docs/overview/04-conventions.md` — quy ước, hình dạng lỗi, ràng buộc validate
5. `SPEC.md` của các feature liên quan trong `docs/features/` — hợp đồng API thật

Sau đó tóm tắt ngắn gọn cho tôi:

- Danh sách endpoint và method, endpoint nào là upsert
- Quy tắc validate và mã lỗi tương ứng (400 / 404)
- Định nghĩa chính xác của MA7, `currentRate`, `requiredRate`, `onTrack`, `remainingKg`
- Ba cạm bẫy dễ sai nhất khi implement mấy hàm đó

Ngắn thôi — dạng bullet, không chép lại nguyên văn spec.
