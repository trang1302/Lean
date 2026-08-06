---
description: Sinh unit/integration test từ file spec markdown bằng agent team
argument-hint: <spec-path-1> [spec-path-2 ...] [--src=<dir>]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task
---

# Sinh test từ spec bằng agent team

> **Điều kiện tiên quyết**
> - Claude Code v2.1.32 trở lên (`claude --version`).
> - Agent Teams bật qua `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
>   (đã set sẵn trong `.claude/settings.local.json`).
> - Nếu teams **không** bật → DỪNG và hướng dẫn tôi bật. Không tự động
>   tụt xuống dùng subagent.

## Tham số thô

$ARGUMENTS

## Cách đọc tham số

- **Spec paths**: mọi tham số không bắt đầu bằng `--`. File hoặc thư mục đều được.
  Nếu không truyền gì → mặc định `2026-08-06-health-tracker-design.md` §9.
- **`--src=<value>`**: thư mục nguồn. Bỏ trống → tự dò (mặc định `server/src`).
- Cờ lạ: dừng và hỏi tôi.

## Bối cảnh cố định của dự án này

Không cần dò lại, đây là sự thật:

| Hạng mục | Giá trị |
|---|---|
| Test framework | Vitest (`server/vitest.config.ts`) |
| Integration HTTP | supertest |
| Vị trí test | `server/test/*.test.ts` |
| Lệnh chạy | `cd server && npm test` |
| Ưu tiên cao nhất | `server/src/stats.ts` — hàm thuần, test được không cần DB |
| Test DB | `server/prisma/test.db` qua `server/test/globalSetup.ts` |

## Kế hoạch thực thi

### Phase 0 — Recon (tự làm, chưa lập team)

1. Liệt kê spec file đã resolve, khử trùng lặp.
2. Trích cấu trúc test case từ spec: heading `### <tên>`, bảng markdown,
   hay Given/When/Then. Nếu spec không có ID sẵn, tự định nghĩa scheme
   (ví dụ `stats-ma7-<slug>`) và ghi rõ.
3. Đọc `server/test/time.test.ts` để học convention đang có.
4. Báo tôi: danh sách spec, 1 test case mẫu, chiến lược parse, scheme ID,
   cơ cấu team đề xuất (vai trò + số lượng + lý do), layout file test.

**DỪNG chờ tôi duyệt trước khi spawn team.**

### Phase 1 — Team: lập kế hoạch

Spawn agent team. Nguyên tắc chia vai:

- **Chia theo chức năng, không chia theo file spec.** Đừng 1 agent / 1 file.
- **Một chủ sở hữu cho mỗi tài nguyên dùng chung.** Fixture/helper/mock chỉ
  một agent được ghi, những agent khác chỉ đọc.
- **Ít nhất một vai phản biện.** Việc của họ là bắt: test dễ flaky, assertion
  giòn, thiếu case biên, mock quá tay.
- Với dự án này, tách tự nhiên là: **stats (hàm thuần)** / **routes
  (integration qua supertest)** / **reviewer**.

Deliverable: `TEST_PLAN.md` ở gốc repo, gồm cấu trúc file test, helper dùng
chung + chủ sở hữu, map đầy đủ `spec case ID → file test + tên test`, chiến
lược mock (ntfy, `node-cron`, `new Date()`), rủi ro, câu hỏi cần tôi trả lời.

**DỪNG. Cho tôi xem plan. Chờ duyệt.**

### Phase 2 — Team: implement

1. Chủ sở hữu helper viết trước, ghi ra đĩa, rồi báo các agent khác.
2. Các agent viết test theo plan, không chồng file.
3. Mỗi test tham chiếu spec case ID trong tên test hoặc comment.
4. Reviewer chạy suite, kiểm tra phủ 1-1 (mọi spec case có test, không có
   test mồ côi), gắn cờ test có mùi flaky.
5. Sửa tới khi suite xanh và phủ đủ.

### Phase 3 — Dọn

Tổng kết: file đã tạo, tổng số test, spec case đã phủ, hạng mục hoãn lại.
Dọn team. Cho tôi xem diff summary.

## Luật cứng

- **Không bao giờ sửa file spec.** Chúng là nguồn chân lý, chỉ đọc.
- **Một spec case → một test.** Không gộp nhiều case vào một test.
- **Không skip test nếu tôi chưa duyệt.** Case nào không làm được thì đưa vào
  mục câu hỏi mở trong `TEST_PLAN.md`, đừng lặng lẽ bỏ.
- **Không đổi framework.** Vitest + supertest, hết.
- **Không sửa code production.** Đây là task viết test. Nếu spec mâu thuẫn với
  code hiện có → báo tôi, viết test theo spec, đừng sửa source.
- **Checkpoint là bắt buộc.** Dừng ở cuối Phase 0 và Phase 1.
- **Test thời gian phải deterministic.** Không để test phụ thuộc `Date.now()`
  thật — inject ngày qua tham số như `time.ts` đã thiết kế.
