---
name: implement-feature
description: Use when asked to implement or code a feature in this repo from a spec, plan file, PRD, or free-form description — establishes the read-spec → survey → TDD → verify order specific to Lean.
---

# Implement Feature từ Spec

## Trigger

Tôi yêu cầu implement / code một chức năng, kèm file spec, plan, PRD, hoặc chỉ mô tả bằng text.

## Bước 1 — Đọc hiểu input

- Input có section "Hướng dẫn cho Claude Code" hoặc đánh số Task → follow đúng thứ tự đó.
- Không có → đọc toàn bộ, rồi tóm tắt lại cho tôi: **làm gì, đụng bảng nào,
  thêm endpoint nào, có đụng `stats.ts` không**.
- Luôn đối chiếu với tài liệu: `docs/README.md` là bản đồ, phần dùng chung ở
  `docs/overview/`, mỗi chức năng có `docs/features/<tên>/SPEC.md`. Sửa feature
  đã có thì đọc `SPEC.md` của nó trước — nhất là mục "Quyết định vượt spec".
  Yêu cầu của tôi mâu thuẫn với spec → nói ra, đừng lặng lẽ chọn một bên.
- Nếu là thứ nằm trong §2 "Không có trong bản này" (AI phân tích ảnh, lưu ảnh,
  DB món ăn dựng sẵn, auth, truy cập từ điện thoại) → **DỪNG**, đọc lý do ở §2
  và hỏi tôi trước khi làm.

## Bước 2 — Khảo sát codebase

Không grep mù. Đọc theo thứ tự này:

```
CLAUDE.md                      → quy ước bắt buộc
server/src/lib/time.ts         → mọi thứ liên quan ngày đi qua đây
server/src/shared/stats/       → hàm thuần đã có gì, đừng viết trùng
server/src/shared/constants.ts → LOCAL_USER_ID, mọi truy vấn phải mang userId
server/prisma/schema.prisma    → bảng đã có gì
server/src/features/*/         → pattern 4 lớp đang dùng
server/test/*.test.ts          → convention test đang dùng
```

Với mỗi bảng cần **đọc**: kiểm tra schema đã có chưa → có thì dùng, **không tạo lại**.
Với mỗi hàm tính toán: kiểm tra `stats.ts` đã có chưa → có thì gọi, không copy công thức.

Tham khảo chéo (chỉ có trên máy tôi, **không thuộc repo này**):
`C:\Project\WorkSpace\Todo\` dùng cùng stack (Express + Prisma + React + ntfy) —
lấy pattern `ntfy.ts`, `scheduler.ts`, cấu hình test port từ đó. Đường dẫn không
tồn tại thì bỏ qua, đừng đi tìm.

## Bước 3 — Test trước

Invoke `superpowers:test-driven-development`.

Thứ tự ưu tiên test theo §9 của spec:
1. `stats.ts` — unit, hàm thuần, ưu tiên cao nhất
2. API — integration qua supertest
3. Nhắc nhở — mock ntfy và cron, không gọi mạng thật

Chạy `cd server && npm test`, xác nhận **đỏ đúng lý do** (chưa có hàm), không
phải đỏ vì import sai. Dán output thật.

## Bước 4 — Implement

Thứ tự: `schema.prisma` → `stats.ts` (hàm thuần) → Zod schema → route → đăng ký
trong `app.ts` → `web/src/api.ts` → UI.

- Đụng endpoint → dùng skill `add-endpoint`.
- Code tối thiểu để test xanh. Không thêm abstraction cho thứ dùng một lần.
- Sửa file đã có → đọc hết file trước, bám style hiện tại, đừng "cải thiện"
  code xung quanh.

## Bước 5 — Verify

Dán output thật, không tóm tắt, không nói "đã chạy và pass" mà không có output:

```bash
cd server && npm test
cd server && npx tsc --noEmit
```

Đụng Prisma schema: `npx prisma db push` rồi `npx prisma generate`.
Đụng `web/`: `cd web && npm run build`.

Invoke `superpowers:verification-before-completion` trước khi tuyên bố xong.

## Bước 6 — Báo cáo

Liệt kê file đã tạo / đã sửa, test pass/fail, chỗ nào lệch spec và vì sao,
còn nợ gì. Không commit — tôi tự commit.

## Không bao giờ làm

- Không dùng `DateTime` cho field `date`.
- Không đặt phép tính ngoài `stats.ts`.
- Không tự suy diễn lại định nghĩa MA7 / `currentRate` / `onTrack` / `remainingKg` —
  chúng ở §6 của spec.
- Không thêm auth, không mở ra LAN, trừ khi tôi yêu cầu tường minh (xem §2).
