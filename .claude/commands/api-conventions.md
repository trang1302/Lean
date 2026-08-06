---
description: Nạp quy ước API + logic thống kê của dự án trước khi code
---

Đọc các nguồn sau và xác nhận đã nạp quy ước:

1. `@CLAUDE.md` — mục "Quy ước bắt buộc"
2. `@2026-08-06-health-tracker-design.md` §4 (mô hình dữ liệu), §5 (API), §6 (logic thống kê)

Sau đó tóm tắt ngắn gọn cho tôi:

- Danh sách endpoint và method, endpoint nào là upsert
- Quy tắc validate và mã lỗi tương ứng (400 / 404)
- Định nghĩa chính xác của MA7, `currentRate`, `requiredRate`, `onTrack`, `remainingKg`
- Ba cạm bẫy dễ sai nhất khi implement mấy hàm đó

Ngắn thôi — dạng bullet, không chép lại nguyên văn spec.
