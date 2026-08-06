---
description: Implement một task đánh số trong implementation plan, theo TDD, có checkpoint
argument-hint: <số-task> [--no-stop]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, TodoWrite, Skill
---

Implement **Task $1** trong `@2026-08-06-health-tracker-plan.md`.

Cờ `$2`: nếu là `--no-stop` thì bỏ qua checkpoint ở Phase 2, chạy thẳng tới hết.

---

## Phase 0 — Đọc và xác định phạm vi

1. Đọc đúng section `## Task $1: ...` trong plan. Không đọc lướt, đọc hết section.
2. Đọc `## Global Constraints` và `## File Structure` ở đầu plan.
3. Nếu task tham chiếu tới §nào của `@2026-08-06-health-tracker-design.md`, đọc §đó.
4. Liệt kê ra:
   - File sẽ **tạo mới** / file sẽ **sửa**
   - Task này phụ thuộc task nào trước đó — kiểm tra các file đó đã tồn tại chưa
   - Hàm/endpoint nào là deliverable

Nếu task phụ thuộc vào một task chưa làm → **DỪNG**, báo tôi biết thiếu gì.

## Phase 1 — Test trước

Invoke `superpowers:test-driven-development`.

Viết test theo đúng các case plan đã liệt kê cho task này. Nếu plan không liệt kê
case cụ thể, lấy từ §9 của spec. Bổ sung case biên nếu thấy thiếu — nhưng nói rõ
case nào là bạn tự thêm.

Chạy `cd server && npm test` — test **phải đỏ** với lý do đúng (chưa có hàm),
không phải đỏ vì lỗi cú pháp hay import sai. Dán output thật.

## Phase 2 — Checkpoint

Báo tôi:

- Danh sách test đã viết + lý do đỏ
- Kế hoạch implement (ngắn, 3–5 dòng)
- Chỗ nào trong plan bạn thấy mơ hồ hoặc thấy plan sai

**DỪNG chờ tôi duyệt** — trừ khi có `--no-stop`.

## Phase 3 — Implement

- Code tối thiểu để test xanh. Không thêm gì plan không yêu cầu.
- Bám naming/style trong `@CLAUDE.md`.
- Nếu buộc phải lệch khỏi plan, ghi lại lý do và báo trong phần tổng kết —
  đừng lệch im lặng.

## Phase 4 — Verify

Chạy đủ và dán output thật, không tóm tắt:

```bash
cd server && npm test
cd server && npx tsc --noEmit
```

Nếu task đụng Prisma schema: `npx prisma db push` + `npx prisma generate`.
Nếu task đụng `web/`: `cd web && npm run build`.

Invoke `superpowers:verification-before-completion` trước khi tuyên bố xong.

## Phase 5 — Tổng kết

```
Task $1 — <tên task>
File tạo:    ...
File sửa:    ...
Test:        <N> pass / <M> fail
Lệch plan:   <có/không — nếu có thì vì sao>
Còn nợ:      <gì chưa làm và vì sao>
Task kế:     Task <N+1> — <tên>
```

Không commit. Tôi tự commit.
