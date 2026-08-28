# Tài liệu Lean Health Tracker

## Tìm cái gì ở đâu

**Bắt đầu từ đây nếu bạn mới vào dự án:** `overview/00-goals-and-scope.md`.

| Câu hỏi | Đọc |
|---|---|
| App này làm gì, và cố tình KHÔNG làm gì? | `overview/00-goals-and-scope.md` |
| Code tổ chức thế nào, vì sao 4 lớp? | `overview/01-architecture.md` |
| Bảng nào, cột nào, `userId` đến từ đâu? | `overview/02-data-model.md` |
| MA7 / tốc độ thay đổi / tiến độ tính chính xác ra sao? | `overview/03-stats.md` |
| Quy ước bắt buộc, hình dạng lỗi, phiên bản thư viện | `overview/04-conventions.md` |
| Muốn thêm AI ước tính calo từ ảnh thì gắn vào đâu? | `overview/05-future-ai.md` |
| Đăng nhập và phiên hoạt động ra sao? | `features/auth/SPEC.md` |
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
| `body-logs` `meals` `goal` `summary` `reminders` | đã xong, 239 test pass |
| `web-shell` | đã có code — router, layout, `apiClient`, các trạng thái dùng chung |
| `web-today` `web-charts` `web-settings` | đã có code, 261 test pass |
| `auth` | **giai đoạn A xong trọn Task 1–11** — đăng ký/đăng nhập/phiên, `requireAuth`, CSRF, helmet, cách ly dữ liệu, chống brute-force, một-phiên-một-tài-khoản |
| `rbac` | **chưa implement** — mới có SPEC + PLAN |

Đợt **`measures-and-goals`** (2026-08-11) đã xong: thêm 3 số đo cơ thể (`chestCm`,
`shoulderCm`, `armCm`) và 6 trường mục tiêu (`startWeightKg`, `startDate`, 4 target vòng),
xuyên từ schema qua API tới hai form web. Spec và kế hoạch ở
`superpowers/specs/2026-08-11-measures-and-goals-design.md` và
`superpowers/plans/2026-08-11-measures-and-goals.md`.

Hai đợt còn lại của yêu cầu gốc **chưa bắt đầu**: `ui-mui` (chuyển UI kit sang MUI) và
`charts-mui` (thay Recharts bằng `@mui/x-charts`, mỗi số đo một biểu đồ, đường mục tiêu
riêng, và tờ lịch tháng theo % tiến độ). Cả hai cần spec riêng.

`auth` và `rbac` đến từ quyết định ngày 2026-08-07: dự án sẽ có đăng nhập và phân quyền
(`overview/00-goals-and-scope.md` §2).

**Giai đoạn A của `auth` đã xong trọn vẹn** (kế hoạch:
`superpowers/plans/2026-08-10-auth-backend-giai-doan-a.md`, Task 1–11). Điều đó nghĩa là:
`requireAuth` mắc một lần ở `app.ts` chặn cả năm router dữ liệu, CSRF bật bằng `csrf-csrf`,
helmet gắn security header, `userId` đến từ `req.session` chứ không còn từ hằng
(`src/shared/constants.ts` đã xóa), đăng nhập sai 5 lần / 15 phút thì khóa, và một tài khoản
chỉ giữ một phiên sống tại một thời điểm.

Hai lưới an toàn quan trọng nhất: `test/features/userIsolation.test.ts` (dữ liệu không rò giữa
hai người dùng) và `test/features/auth/middleware.test.ts` (không route dữ liệu nào lọt ra ngoài
`requireAuth`).

**Còn nợ:** `rbac` (giai đoạn B, cột `role`) chưa có dòng code nào; giai đoạn C (API quản trị) và
D (màn Tài khoản / Phân quyền) cũng vậy.

**Đợt `measures-and-goals` (2026-08-11): xong.** Thêm ba số đo cơ thể (`chestCm`,
`shoulderCm`, `armCm`) vào `BodyLog` và sáu trường mục tiêu (điểm xuất phát + bốn đích vòng
cơ thể) vào `Goal`, xuyên suốt từ schema → API → hai form web (`web-today`, `web-settings`).
Spec đầy đủ: `docs/superpowers/specs/2026-08-11-measures-and-goals-design.md`. Không tính %
tiến độ (đợt `charts-mui`, chưa bắt đầu) và không đổi UI kit sang MUI (cũng đợt `charts-mui`).

## Liên quan

- `../CLAUDE.md` — hướng dẫn cho Claude Code, tóm tắt quy ước
- `../AGENTS.md` — luật bắt buộc cho mọi coding agent
