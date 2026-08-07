# Tài liệu Lean Health Tracker

## Tìm cái gì ở đâu

**Bắt đầu từ đây nếu bạn mới vào dự án:** `overview/00-goals-and-scope.md`.

| Câu hỏi | Đọc |
|---|---|
| App này làm gì, và cố tình KHÔNG làm gì? | `overview/00-goals-and-scope.md` |
| Code tổ chức thế nào, vì sao 4 lớp? | `overview/01-architecture.md` |
| Bảng nào, cột nào, vì sao có `userId` khi chưa có đăng nhập? | `overview/02-data-model.md` |
| MA7 / tốc độ thay đổi / tiến độ tính chính xác ra sao? | `overview/03-stats.md` |
| Quy ước bắt buộc, hình dạng lỗi, phiên bản thư viện | `overview/04-conventions.md` |
| Muốn thêm AI ước tính calo từ ảnh thì gắn vào đâu? | `overview/05-future-ai.md` |
| Đăng nhập và phiên hoạt động ra sao? (kế hoạch, chưa code) | `features/auth/SPEC.md` |
| Vai trò và quyền chia thế nào? (kế hoạch, chưa code) | `features/rbac/SPEC.md` |
| Vì sao trước đây cố tình không có đăng nhập, và vì sao đổi? | `overview/00-goals-and-scope.md` |
| Còn gì chưa chốt, cái nào là bug cần sửa? | `overview/06-open-questions.md` |
| Một endpoint cụ thể hành xử thế nào? | `features/<tên>/SPEC.md` |
| Feature đó đã xong chưa, còn nợ gì? | `features/<tên>/PLAN.md` |
| Cài đặt và chạy app thế nào? | `../README.md` |

## Quy ước tài liệu

**`overview/`** chứa thứ dùng chung, không thuộc feature nào. Sửa ở đây là ảnh
hưởng mọi feature — cân nhắc kỹ. Hai file cuối là ngoại lệ: `05-future-ai.md` mô
tả thứ **chưa tồn tại**, `06-open-questions.md` gom mọi thứ **chưa chốt** từ cả
overview lẫn 5 `features/*/PLAN.md`.

**`features/<tên>/`** — mỗi chức năng một thư mục, đúng hai file:

- `SPEC.md` — feature làm gì và hành xử ra sao. Với feature đã code xong, đây là
  mô tả **hành vi thật của code**, không phải ý định ban đầu. Khi code và SPEC
  lệch nhau thì **code đúng** — sửa SPEC cho khớp, đừng để tài liệu nói dối.
- `PLAN.md` — trạng thái, file đã tạo, lệnh verify, việc còn nợ.

Tên thư mục feature khớp thư mục code: `features/body-logs/` ↔
`server/src/features/bodyLogs/`.

## Mục quan trọng nhất trong mỗi SPEC

**"Quyết định vượt spec".** Spec gốc không thể phủ hết mọi tình huống, nên lúc
code luôn phải chốt thêm: trả 201 hay 200, response có kèm `updatedAt` không,
gõ sai tên trường thì báo lỗi hay bỏ qua. Những quyết định đó **không đọc ra
được từ code** — chỉ thấy kết quả, không thấy lý do. Mất phần này là người sau
sẽ "sửa cho hợp lý" và làm hỏng thứ đang đúng.

## Trạng thái

| Feature | Trạng thái |
|---|---|
| `body-logs` `meals` `goal` `summary` `reminders` | đã xong, 208 test pass |
| `web-shell` | chưa bắt đầu — **phải làm trước 3 trang web** |
| `web-today` `web-charts` `web-settings` | chưa bắt đầu, chặn bởi `web-shell` |
| `auth` `rbac` | **chưa implement** — mới có SPEC + PLAN |

`auth` và `rbac` đến từ quyết định ngày 2026-08-07: dự án sẽ có đăng nhập và phân quyền
(`overview/00-goals-and-scope.md` §2). **Chưa có dòng code nào** — bản đang chạy vẫn không xác
thực và vì thế vẫn **chỉ được chạy localhost**.

## Liên quan

- `../CLAUDE.md` — hướng dẫn cho Claude Code, tóm tắt quy ước
- `../AGENTS.md` — luật bắt buộc cho mọi coding agent
