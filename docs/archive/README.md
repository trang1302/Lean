# Kho lưu — tài liệu gốc

Hai file trong thư mục này là **spec và plan nguyên bản viết ngày 2026-08-06**,
trước khi dự án được tách thành `docs/overview/` và `docs/features/`.

**Chúng đã ĐÓNG BĂNG. Đừng sửa, đừng đọc để tra cứu cách app hoạt động.**

| Muốn biết | Đọc |
|---|---|
| App hiện hoạt động thế nào | `../README.md` → `../overview/` và `../features/` |
| Ngày xưa dự định thế nào | ở đây |

## Vì sao còn giữ

Tài liệu feature dẫn chiếu vào đây khi cần chỉ ra **code đã đi khác ý định ban
đầu ở đâu và vì sao** — ví dụ `Goal` dùng `userId` làm khóa chính chứ không phải
`id = "singleton"`, hay `GET /summary` không bao giờ trả `days` rỗng. Bỏ hai file
này là mất phần "ngày xưa định làm gì", và lần sau có người sẽ tưởng những chỗ
lệch đó là lỗi rồi "sửa" ngược lại.

## Cảnh báo

Nội dung ở đây **đã lỗi thời** ở nhiều chỗ: phiên bản thư viện cũ (Express 4,
Prisma 5, Zod 3), đường dẫn file cũ (`src/stats.ts`, `src/routes/`), schema chưa
có `userId`, và lệnh chạy sai so với `package.json` hiện tại.

Khi tài liệu ở đây mâu thuẫn với `../overview/` hoặc `../features/` thì
**bên kia đúng**.
