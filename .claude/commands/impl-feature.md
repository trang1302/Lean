---
description: Implement một chức năng theo SPEC + PLAN của nó, theo TDD, có checkpoint
argument-hint: <tên-feature> [--no-stop]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, TodoWrite, Skill
---

Implement chức năng **$1** trong dự án này.

Cờ `$2`: nếu là `--no-stop` thì bỏ qua checkpoint ở Phase 2, chạy thẳng tới hết.

---

## Phase 0 — Đọc và xác định phạm vi

1. Đọc `@docs/features/$1/SPEC.md` — hết, không đọc lướt. Chú ý mục
   **"Quyết định vượt spec"**: nhiều hành vi trông tùy tiện thật ra có lý do,
   và lý do chỉ nằm ở đó chứ không đọc ra được từ code.
2. Đọc `@docs/features/$1/PLAN.md` — trạng thái hiện tại và việc còn nợ.
3. Đọc phần dùng chung liên quan trong `@docs/overview/`:
   `04-conventions.md` luôn luôn; `03-stats.md` nếu có tính toán;
   `02-data-model.md` nếu đụng bảng.
4. Liệt kê ra:
   - File sẽ **tạo mới** / file sẽ **sửa**
   - Chức năng này phụ thuộc gì — kiểm tra những thứ đó đã tồn tại chưa
   - Deliverable là gì

Nếu `docs/features/$1/` không tồn tại → **DỪNG**, báo tôi biết và hỏi tên đúng.
Nếu `PLAN.md` ghi trạng thái **ĐÃ XONG** → **DỪNG**, hỏi tôi định sửa gì, đừng
tự làm lại.

## Phase 1 — Test trước

Invoke `superpowers:test-driven-development`.

Viết test theo các case trong `SPEC.md`. Bổ sung case biên nếu thấy thiếu —
nhưng nói rõ case nào là bạn tự thêm.

Chạy test — **phải đỏ với lý do đúng** (chưa có hàm/route), không phải đỏ vì lỗi
cú pháp hay import sai. Dán output thật.

## Phase 2 — Checkpoint

Báo tôi: test đã viết + lý do đỏ · kế hoạch implement (3–5 dòng) · chỗ nào trong
SPEC bạn thấy mơ hồ hoặc thấy SPEC sai.

**DỪNG chờ tôi duyệt** — trừ khi có `--no-stop`.

## Phase 3 — Implement

- Bám cấu trúc 4 lớp: controller → service → repository → Prisma.
  `repositories/` là chỗ **duy nhất** được import `prisma`.
- Mọi truy vấn mang `userId` lấy từ `LOCAL_USER_ID`.
- Phép tính nằm ở `shared/stats/`, không ở service hay controller.
- Code tối thiểu để test xanh. Không thêm gì SPEC không yêu cầu.
- Buộc phải lệch khỏi SPEC thì ghi lại lý do và báo ở tổng kết — đừng lệch im lặng.

## Phase 4 — Verify

Chạy đủ và dán output thật:

```bash
cd server && npm test
cd server && npx tsc --noEmit
```

Đụng Prisma schema: `npx prisma generate`. Đụng `web/`: `cd web && npm run build`.

Invoke `superpowers:verification-before-completion` trước khi tuyên bố xong.

## Phase 5 — Cập nhật tài liệu

**Bắt buộc, không được bỏ.** Code đổi mà tài liệu không đổi là tài liệu nói dối.

- `docs/features/$1/SPEC.md` — hành vi mới, và **mọi quyết định vượt spec** bạn
  vừa chốt (mã trạng thái, hình dạng response, ràng buộc validate tự thêm) kèm
  **lý do**. Đây là phần người sau không đọc ra được từ code.
- `docs/features/$1/PLAN.md` — trạng thái, file đã tạo, việc còn nợ.

## Phase 6 — Tổng kết

```
Feature $1
File tạo:    ...
File sửa:    ...
Test:        <N> pass / <M> fail
Lệch SPEC:   <có/không — nếu có thì vì sao>
Tài liệu:    <đã cập nhật những gì>
Còn nợ:      <gì chưa làm và vì sao>
```

Không commit. Tôi tự commit.
