---
description: Implement đầy đủ feature theo các file spec/plan được đính kèm
argument-hint: <đường-dẫn-file-1> [file-2 ...] [ghi chú thêm]
---

Implement the feature as described in the attached files below.
Read and implement fully. Use superpowers skill, think outside the box.

Ràng buộc riêng của dự án này (không được vi phạm):

- `date` luôn là chuỗi `"YYYY-MM-DD"`, mọi xử lý đi qua `server/src/time.ts`.
- Mọi phép tính thống kê nằm trong `server/src/stats.ts` dưới dạng **hàm thuần** —
  không đọc DB, không đụng HTTP. Định nghĩa chính xác ở §6 của
  `@2026-08-06-health-tracker-design.md`, không tự suy diễn lại.
- Validate mọi input bằng Zod. Lỗi validate → `400` kèm danh sách trường sai.
- Viết test trước khi viết implementation (`superpowers:test-driven-development`).
- Chạy `npm test` trong `server/` và báo output thật trước khi nói là xong.

$ARGUMENTS
