# Dọn nợ tài liệu sau `auth` + `rbac` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xóa mọi khẳng định "chưa có đăng nhập / `LOCAL_USER_ID`" còn sót trong tài liệu sống và
trong hướng dẫn cho agent, và dựng một test canh để lớp nợ này không tái phát.

**Architecture:** Nợ này đã được `docs/features/auth/SPEC.md` §10 liệt kê sẵn từ trước khi code
tồn tại, kèm ràng buộc *"không sửa file nào trong danh sách khi chưa có code chạy"*. Code đã chạy
(giai đoạn A–D, commit `9422401`), nên điều kiện đó đã thỏa và danh sách trở thành việc phải làm.
Plan bám đúng danh sách đó, cộng ba chỗ SPEC.md không liệt kê nhưng grep tìm ra.

Trục của plan là **một test canh viết trước** (Task 1): nó quét repo tìm khẳng định cũ và đỏ ngay.
Các task sau lần lượt làm nó xanh. Nhờ vậy đây không phải một đợt dọn thủ công rồi quên, mà là một
ràng buộc có thể chạy lại.

**Tech Stack:** Vitest 4 (test canh chạy trong suite của `server/`) · `node:fs` để quét file.
Không thêm dependency nào.

**Spec:** [`docs/features/auth/SPEC.md`](../../features/auth/SPEC.md) §10 (bảng 11 dòng) ·
[`docs/superpowers/specs/2026-08-10-auth-rbac-3-roles-design.md`](../specs/2026-08-10-auth-rbac-3-roles-design.md)
§12 (5 dòng bổ sung)

---

## Global Constraints

Áp dụng cho **mọi task**. Không lặp lại trong từng task.

- **Tài liệu Lean mô tả HÀNH VI THẬT, không mô tả ý định.** Code và tài liệu lệch nhau thì
  **code đúng** — sửa tài liệu, đừng sửa code cho khớp tài liệu (`CLAUDE.md`).
- **KHÔNG đụng `docs/archive/**` và `.superpowers/**`.** Đó là ảnh chụp lịch sử có chủ đích;
  sửa chúng là xóa mất bối cảnh "vì sao dự án từng trông như vậy". Test canh phải loại trừ
  hai thư mục này.
- **KHÔNG đụng `server/data.db`** — dữ liệu sức khỏe thật.
- Trạng thái code hiện tại, dùng làm nguồn sự thật khi viết lại câu chữ:
  - 3 vai trò `USER` (6 quyền) · `ADMIN` (8) · `SYSTEM_ADMIN` (10); 10 quyền `resource:action`.
  - `requireAuth` mắc một lần ở `app.ts`; `permissionGuard` cắm một lần ở `/api`, mặc định TỪ CHỐI.
  - `userId` đến từ `req.session`; `server/src/shared/constants.ts` **đã xóa**.
  - Còn nợ bảo mật thật: **chưa có audit log RBAC**, và **cache quyền chỉ đúng với một tiến trình**.
- Commit message: `<type>(<scope>): <subject>`, không có "Claude"/"AI-generated"/`Co-Authored-By`.
- Verify chạy từ `C:\Project\WorkSpace\Lean\server`.
- **ĐỊNH NGHĨA DONE của Task 2–6:** test canh của Task 1 không còn nêu tên **bất kỳ file nào
  thuộc phạm vi task đó**. Danh sách dòng trong plan là **chỉ dẫn, không phải giới hạn** — nó
  được rút từ `auth/SPEC.md` §10 và một lần grep, và pre-flight scan đã chứng minh nó thiếu 9
  chỗ. Gặp hit chưa được liệt kê mà nằm trong phạm vi task thì **vẫn phải sửa**, và ghi vào
  report để controller biết.

---

## File Structure

**Tạo mới:**

| File | Trách nhiệm |
|---|---|
| `server/test/docs/docsConsistency.test.ts` | Quét tài liệu sống + hướng dẫn agent, đỏ khi còn khẳng định cũ. Là lưới an toàn duy nhất cho lớp nợ này |

**Sửa — hướng dẫn cho agent (ưu tiên cao nhất, đang dạy sai):**

| File | Dòng | Đang nói sai |
|---|---|---|
| `.claude/commands/impl-feature.md` | 52 | *"Mọi truy vấn mang `userId` lấy từ `LOCAL_USER_ID`"* |
| `.claude/commands/impl-files.md` | 13–14 | nt |
| `.claude/skills/implement-feature/SKILL.md` | 33 | *"`constants.ts` → `LOCAL_USER_ID`"* |

**Sửa — tài liệu dùng chung:**

| File | Dòng | Đang nói sai |
|---|---|---|
| `docs/overview/04-conventions.md` | 18, 22 | *"lấy từ hằng `LOCAL_USER_ID` … Chưa có đăng nhập"* · *"Bản đang chạy chưa có auth"* |
| `docs/overview/01-architecture.md` | 29, 82, 83, **89**, 93 | cây thư mục `constants.ts` · đánh đổi SQLite · *"chưa implement"* · dòng bảng *"Cột `userId` từ đầu, chưa có auth"* |
| `docs/overview/02-data-model.md` | **5**, 11, 13, 15 | dòng "Liên quan" · *"dù bản đang chạy chưa có đăng nhập"* · *"chưa có dòng code auth nào"* |
| `docs/overview/00-goals-and-scope.md` | 46, 48, 54, 56 | *"Không có đăng nhập"* · *"CHƯA implement"* · cảnh báo localhost |
| `docs/overview/05-future-ai.md` | **95** | *"khi chưa có auth, bất kỳ ai…"* — pre-flight scan tìm ra, plan gốc bỏ sót |
| `docs/README.md` | **17** | *"vì sao trước đây cố tình không có đăng nhập"* — pre-flight scan tìm ra |
| `AGENTS.md` | 17–18, 33–34, **60** | *"dù chưa có đăng nhập — dùng hằng `LOCAL_USER_ID`"* · *"chưa implement"* |
| `README.md` | 187–189 | *"không có middleware xác thực, mọi bản ghi mang một `LOCAL_USER_ID` cố định"* |

**Sửa — SPEC của feature (mô tả chữ ký repository đã đổi ở giai đoạn A):**

| File | Dòng |
|---|---|
| `docs/features/body-logs/SPEC.md` | 26, 194–220 |
| `docs/features/body-logs/PLAN.md` | 51 |
| `docs/features/meals/SPEC.md` | 67, 75, 191, 239 |
| `docs/features/meals/PLAN.md` | 43 |
| `docs/features/goal/SPEC.md` | 37 · `goal/PLAN.md` 25, 38 |
| `docs/features/reminders/SPEC.md` | 114–116 |
| `docs/features/meals/SPEC.md` | **197** — pre-flight scan tìm ra |
| `docs/features/rbac/SPEC.md` | **192, 589** — pre-flight scan tìm ra |
| `docs/features/web-shell/PLAN.md` | **15, 62, 478** — *"backend `auth` chưa có dòng code nào"*, pre-flight scan tìm ra |

**Sửa — câu hỏi mở đã có câu trả lời trong code:**

| File | Mục |
|---|---|
| `docs/overview/06-open-questions.md` | Bảng tóm tắt + Q11–Q15, **cộng dòng 17 và 269** (pre-flight scan tìm ra) |

---

## Task 1: Test canh — đỏ trước

**Files:**
- Create: `server/test/docs/docsConsistency.test.ts`

**Interfaces:**
- Produces: không export gì. Đây là test thuần, các task sau chỉ chạy nó.

> **Vì sao task này đứng đầu.** Không có nó thì đợt dọn này là một lần sửa tay rồi quên, và lần
> sau ai đó thêm một câu "chưa có đăng nhập" sẽ không ai biết. Có nó thì nợ tái phát là một test
> đỏ.

- [ ] **Step 1: Viết test canh**

```ts
// server/test/docs/docsConsistency.test.ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tài liệu Lean mô tả HÀNH VI THẬT. Suite này canh đúng một lớp nợ: những câu
 * mô tả trạng thái TRƯỚC khi có auth/RBAC, còn sót lại sau khi code đã đổi.
 *
 * Nó không kiểm văn phong và không kiểm nội dung — chỉ kiểm những chuỗi mà sự
 * tồn tại của chúng ĐÃ LÀ sai, vì thứ chúng mô tả không còn tồn tại.
 */

// `fileURLToPath` chứ không `import.meta.dirname`: cái sau đòi Node >= 20.11,
// và một test canh mà chết vì phiên bản Node là một test canh vô dụng.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * Loại trừ có chủ đích:
 * - `docs/archive/`  — ảnh chụp thiết kế gốc. Sửa là xóa mất bối cảnh "vì sao
 *                      dự án từng trông như vậy".
 * - `.superpowers/`  — nhật ký làm việc của các đợt đã đóng.
 * - `auth/SPEC.md`   — §10 CHÍNH LÀ danh sách nợ này; nó phải được phép nhắc tên.
 * - `rbac/PLAN.md`   — giữ một khối "trạng thái cũ" để đối chiếu.
 * - `docs/superpowers/plans|specs` — plan và design doc mô tả thời điểm chúng
 *                      được viết, không phải hiện tại.
 */
const EXCLUDED = [
  join('docs', 'archive'),
  '.superpowers',
  'node_modules',
  join('docs', 'features', 'auth', 'SPEC.md'),
  join('docs', 'features', 'auth', 'PLAN.md'),
  join('docs', 'features', 'rbac', 'PLAN.md'),
  join('docs', 'superpowers', 'plans'),
  join('docs', 'superpowers', 'specs'),
];

/** Thư mục được quét. Hướng dẫn cho agent nằm ngoài `docs/` nên phải liệt kê riêng. */
const SCANNED = ['docs', '.claude', 'AGENTS.md', 'README.md', 'CLAUDE.md'];

function collectMarkdown(target: string): string[] {
  const abs = join(REPO_ROOT, target);
  let stat;
  try {
    stat = statSync(abs);
  } catch {
    return []; // file tùy chọn (vd. CLAUDE.local.md) không tồn tại trên máy khác
  }
  if (stat.isFile()) return abs.endsWith('.md') ? [abs] : [];

  const out: string[] = [];
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const child = join(abs, entry.name);
    const rel = relative(REPO_ROOT, child);
    if (EXCLUDED.some((skip) => rel === skip || rel.startsWith(skip + sep))) continue;
    if (entry.isDirectory()) out.push(...collectMarkdown(rel));
    else if (entry.name.endsWith('.md')) out.push(child);
  }
  return out;
}

const FILES = SCANNED.flatMap(collectMarkdown);

interface Hit {
  file: string;
  line: number;
  text: string;
}

function findAll(pattern: RegExp): Hit[] {
  const hits: Hit[] = [];
  for (const file of FILES) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((text, index) => {
      if (pattern.test(text)) {
        hits.push({ file: relative(REPO_ROOT, file), line: index + 1, text: text.trim() });
      }
    });
  }
  return hits;
}

describe('tài liệu sống không được mô tả trạng thái trước khi có auth', () => {
  it('quét được ít nhất 20 file — sai đường dẫn thì suite này xanh giả', () => {
    // Không có ca này thì một lỗi đường dẫn biến cả suite thành "0 file, 0 hit,
    // xanh" — tệ hơn không có test.
    expect(FILES.length).toBeGreaterThan(20);
  });

  it('không còn nhắc hằng LOCAL_USER_ID', () => {
    // `server/src/shared/constants.ts` đã bị xóa ở giai đoạn A. Mọi hướng dẫn
    // còn nhắc tên này đều dạy agent viết code không compile được.
    expect(findAll(/LOCAL_USER_ID/)).toEqual([]);
  });

  it('không còn khẳng định app chưa có đăng nhập', () => {
    expect(findAll(/chưa có đăng nhập|không có đăng nhập|Không có đăng nhập/)).toEqual([]);
  });

  it('không còn khẳng định app không có middleware xác thực', () => {
    expect(
      findAll(/không có auth|Không có auth|không có middleware xác thực|chưa có auth/),
    ).toEqual([]);
  });

  it('không còn khẳng định rbac chưa implement', () => {
    expect(findAll(/chưa implement|CHƯA implement|chưa có dòng code/)).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận ĐỎ**

Run: `npx vitest run test/docs/docsConsistency.test.ts`

Expected: FAIL. Bốn ca cuối đỏ, mỗi ca in ra danh sách `{ file, line, text }` — đó chính là
danh sách việc của Task 2–6. Ca đầu (đếm file) phải XANH; nếu nó đỏ thì `REPO_ROOT` sai.

- [ ] **Step 3: Commit**

```bash
git add server/test/docs/docsConsistency.test.ts
git commit -m "test(docs): guard against pre-auth claims in living docs"
```

---

## Task 2: Hướng dẫn cho agent

**Files:**
- Modify: `.claude/commands/impl-feature.md:52`
- Modify: `.claude/commands/impl-files.md:13-14`
- Modify: `.claude/skills/implement-feature/SKILL.md:33`

**Interfaces:**
- Consumes: test canh của Task 1.

> **Ưu tiên cao nhất trong plan.** Ba file này không phải tài liệu tham khảo — chúng là chỉ thị
> mà agent đọc rồi làm theo. Một agent viết feature mới hôm nay sẽ import một hằng đã bị xóa, và
> tệ hơn: sẽ bỏ qua phiên đăng nhập vì hướng dẫn không nhắc tới nó.

- [ ] **Step 1: Sửa `.claude/commands/impl-feature.md`**

Thay dòng 52:

```markdown
- Mọi truy vấn mang `userId` lấy từ `LOCAL_USER_ID`.
```

bằng:

```markdown
- Mọi truy vấn mang `userId`, lấy từ **phiên đăng nhập**: controller đọc `req.user!.id`
  (do `requireAuth` gắn) rồi truyền xuống service làm **tham số đầu tiên**, service truyền
  tiếp xuống repository. Service KHÔNG đọc `req`.
- **Route mới phải khai vào `server/src/shared/rbac/permissionRegistry.ts`**, nếu không nó trả
  `403` (mặc định TỪ CHỐI). Dòng hẹp đứng trước dòng rộng.
```

- [ ] **Step 2: Sửa `.claude/commands/impl-files.md`**

Thay hai dòng 13–14:

```markdown
- Endpoint đi đủ 4 lớp controller → service → repository → Prisma. Mọi truy vấn
  mang `userId` lấy từ `LOCAL_USER_ID`.
```

bằng:

```markdown
- Endpoint đi đủ 4 lớp controller → service → repository → Prisma. Mọi truy vấn
  mang `userId` lấy từ phiên (`req.user!.id`), truyền xuống làm tham số đầu tiên.
- Route mới phải khai vào `server/src/shared/rbac/permissionRegistry.ts` — không khai là `403`.
```

- [ ] **Step 3: Sửa `.claude/skills/implement-feature/SKILL.md`**

Thay dòng 33:

```
server/src/shared/constants.ts → LOCAL_USER_ID, mọi truy vấn phải mang userId
```

bằng:

```
server/src/shared/rbac/       → permissionRegistry (khai route mới ở đây), guard, cache
server/src/features/auth/     → requireAuth gắn req.user; userId đến từ phiên
```

- [ ] **Step 4: Chạy test, xác nhận ba file này hết bị nêu tên**

Run: `npx vitest run test/docs/docsConsistency.test.ts`

Expected: vẫn FAIL (Task 3–6 chưa làm), nhưng trong output **không còn** dòng nào thuộc
`.claude/`. Kiểm nhanh: `grep -rn "LOCAL_USER_ID" .claude/` → không kết quả.

- [ ] **Step 5: Commit**

```bash
git add .claude/commands/impl-feature.md .claude/commands/impl-files.md .claude/skills/implement-feature/SKILL.md
git commit -m "docs(agents): userId comes from session, not a deleted constant"
```

---

## Task 3: `docs/overview/`

**Files:**
- Modify: `docs/overview/04-conventions.md:18,22`
- Modify: `docs/overview/01-architecture.md:29,83,93`
- Modify: `docs/overview/02-data-model.md:11,13,15`
- Modify: `docs/overview/00-goals-and-scope.md:46,48,54,56`
- Modify: `docs/overview/05-future-ai.md:95`
- Modify: `docs/overview/01-architecture.md:89` · `02-data-model.md:5`

- [ ] **Step 1: `04-conventions.md` — hai dòng**

Dòng 18, thay:

```markdown
- **Mọi bảng và mọi truy vấn mang `userId`**, lấy từ hằng `LOCAL_USER_ID` trong `server/src/shared/constants.ts`. Chưa có đăng nhập — nhưng khóa đã là `(userId, date)` để sau này thêm auth không phải migrate lại schema.
```

bằng:

```markdown
- **Mọi bảng và mọi truy vấn mang `userId`**, lấy từ phiên đăng nhập (`req.user.id`, do `requireAuth` gắn). Khóa là `(userId, date)` từ đầu — nhờ vậy việc thêm auth không phải migrate lại schema, và khoản đầu tư đó đã được thu hồi ở giai đoạn A.
```

Dòng 22, thay:

```markdown
- **Bản đang chạy chưa có auth, chưa có middleware xác thực** → chỉ được chạy localhost. Đây là **trạng thái hiện tại**, không còn là quy ước vĩnh viễn: quyết định đã đảo ngày 2026-08-07, spec + plan ở `../features/{auth,rbac}/`. Khi làm xong, quy ước sẽ là *enforcement 100% ở tầng middleware, không check quyền rải rác trong controller hay service*.
```

bằng:

```markdown
- **Enforcement 100% ở tầng middleware.** `requireAuth` (ai) rồi `permissionGuard` (được làm gì), cắm mỗi thứ đúng một lần ở `app.ts`. **Không** có `if (user.role === ...)` trong controller hay service. Bất biến trên HÀNG DỮ LIỆU (ownership, và "ADMIN không đụng tài khoản SYSTEM_ADMIN") thì ở service — đó là chuyện khác, xem `../features/rbac/SPEC.md` §5.
- **Vẫn chỉ chạy localhost**, nhưng vì lý do khác trước: đã có xác thực, còn thiếu audit log RBAC và cache quyền chưa dùng chung được giữa nhiều tiến trình.
```

- [ ] **Step 2: `01-architecture.md` — ba chỗ**

Dòng 29, thay `│   │   │   ├── constants.ts         # LOCAL_USER_ID` bằng:

```
│   │   │   ├── rbac/                # permissionRegistry, guard, cache
│   │   │   ├── security/            # password (Argon2id), csrf
```

Dòng 83, thay ô cuối của dòng bảng `~~**Không có đăng nhập**~~`:

```markdown
| Spec + plan ở `../features/{auth,rbac}/`, **chưa implement**. Bản đang chạy vẫn không có auth → chỉ localhost |
```

bằng:

```markdown
| Đã làm xong giai đoạn A–D (2026-08-28): phiên server-side, CSRF, 3 vai trò, 10 quyền. Vẫn chỉ localhost vì còn thiếu audit log RBAC |
```

Dòng 82, ô "Đánh đổi" của dòng **SQLite**, thay `Không chạy được nhiều tiến trình ghi đồng thời — không thành vấn đề với 1 người dùng` bằng:

```markdown
Một writer tại một thời điểm. Mỗi lần đăng nhập ghi ít nhất hai hàng (`Session` + `LoginAttempt`), nên đây là thứ phải xem lại khi số người dùng thật tăng — xem [`06-open-questions.md`](06-open-questions.md) Q11
```

Dòng 93, thay:

```markdown
Quyết định "không đăng nhập" **đã đảo**. Việc thêm auth hóa ra không chỉ là "thêm middleware vào `app.ts`" như câu này từng viết — nó kéo theo bảng `User`/`Role`/`Permission`, thay hằng `LOCAL_USER_ID` ở mọi repository, migrate dữ liệu `userId='local'`, và một trang đăng nhập ở web. Xem `../features/auth/PLAN.md`.
```

bằng:

```markdown
Quyết định "không đăng nhập" **đã đảo và đã làm xong**. Nó hóa ra không chỉ là "thêm middleware vào `app.ts`": kéo theo bảng `User`/`Session`/`LoginAttempt`/`Role`/`Permission`/`RolePermission`, đổi chữ ký repository ở ba feature, viết lại scheduler nhắc nhở theo nhiều người dùng, và bốn màn hình web. Xem `../features/auth/PLAN.md` và `../features/rbac/PLAN.md`.
```

- [ ] **Step 3: `02-data-model.md` — ba chỗ**

Dòng 11, thay `**Mọi bảng mang cột `userId` ngay từ đầu, dù bản đang chạy chưa có đăng nhập.** Hiện tại mọi bản ghi dùng hằng `LOCAL_USER_ID` trong `src/shared/constants.ts`.` bằng:

```markdown
**Mọi bảng mang cột `userId` ngay từ đầu**, từ trước khi có đăng nhập. Giá trị của cột đó nay đến từ phiên (`req.user.id`).
```

Dòng 13, thay câu cuối `Khi thêm auth, grep `LOCAL_USER_ID` ra đúng danh sách chỗ cần thay bằng user lấy từ session.` bằng:

```markdown
Khoản đầu tư đó đã được thu hồi: giai đoạn A thay nguồn của `userId` mà **không đổi một khóa nào** của bốn bảng dữ liệu.
```

Dòng 15, thay `Trạng thái: mới có spec + plan, **chưa có dòng code auth nào**.` bằng:

```markdown
Trạng thái: **đã xong** (2026-08-28). Bốn bảng dữ liệu thêm đúng một dòng quan hệ `user User @relation(..., onDelete: Cascade)`; `@@id([userId, date])`, `@@unique([userId, kind])` và `Goal.userId` làm khóa chính đều giữ nguyên.
```

- [ ] **Step 4: `00-goals-and-scope.md` — ba chỗ**

Dòng 48, thay `Dù bản đang chạy chưa có đăng nhập, **mọi bảng vẫn mang cột `userId` ngay từ đầu**` bằng:

```markdown
**Mọi bảng mang cột `userId` ngay từ đầu**
```

Dòng 54, thay `**Trạng thái: đã có spec + plan, CHƯA implement.** Chưa có dòng code auth nào. Bản đang chạy vẫn là bản không xác thực, mọi bản ghi vẫn mang `userId = 'local'`.` bằng:

```markdown
**Trạng thái: XONG (2026-08-28).** Đăng ký, đăng nhập, phiên server-side, CSRF, chống brute-force, cách ly dữ liệu theo người dùng, ba vai trò và mười quyền, API quản trị, và hai khối quản trị trên web.
```

Dòng 56, thay cả khối cảnh báo bằng:

```markdown
> **Vẫn chỉ chạy localhost — nhưng vì lý do khác trước.** Không còn là "ai chạm được cổng cũng đọc được tất cả"; giờ là hai khoản nợ hẹp hơn: **chưa có audit log** cho thao tác phân quyền, và **cache quyền nằm trong bộ nhớ tiến trình** nên chạy nhiều instance sẽ sai im lặng. Xử lý hai khoản đó trước khi mở ra LAN hoặc cloud.
```

- [ ] **Step 5: Chạy test**

Run: `npx vitest run test/docs/docsConsistency.test.ts`

Expected: vẫn FAIL, nhưng output **không còn** dòng nào thuộc `docs/overview/`.

- [ ] **Step 6: Commit**

```bash
git add docs/overview/
git commit -m "docs(overview): describe the app that exists, not the pre-auth one"
```

---

## Task 4: `AGENTS.md` và `README.md`

**Files:**
- Modify: `AGENTS.md:17-18,33-34,60`
- Modify: `docs/README.md:17`
- Modify: `CLAUDE.md:65`
- Modify: `README.md:187-189`

- [ ] **Step 1: `AGENTS.md` — hai chỗ**

Dòng 17–18, thay:

```markdown
Cấu trúc feature-first 4 lớp, bám quán lệ của `upip`. Mọi bảng có cột `userId`
dù chưa có đăng nhập — dùng hằng `LOCAL_USER_ID`.
```

bằng:

```markdown
Cấu trúc feature-first 4 lớp, bám quán lệ của `upip`. Mọi bảng có cột `userId`,
giá trị đến từ phiên đăng nhập.
```

Dòng 33–34, thay:

```markdown
- **Mọi truy vấn mang `userId`**, lấy từ `LOCAL_USER_ID` trong
  `server/src/shared/constants.ts`.
```

bằng:

```markdown
- **Mọi truy vấn mang `userId`**, lấy từ `req.user!.id` ở controller rồi truyền
  xuống service làm tham số đầu tiên. Service không đọc `req`.
- **Route mới phải khai vào `server/src/shared/rbac/permissionRegistry.ts`** —
  mặc định là TỪ CHỐI, không khai là `403`.
```

- [ ] **Step 2: `CLAUDE.md` — câu tự nhắc tên hằng đã xóa**

Dòng 65 hiện viết `Hằng \`LOCAL_USER_ID\` và \`src/shared/constants.ts\` **đã bị xóa** — thấy
tên đó ở đâu là tài liệu cũ.` Câu này đúng về nội dung nhưng chứa đúng chuỗi mà test canh cấm.
Viết lại không nêu tên:

```markdown
Hằng người-dùng-cục-bộ cũ và `src/shared/constants.ts` **đã bị xóa** ở giai đoạn A — thấy tên
hằng đó ở tài liệu nào thì tài liệu đó là bản cũ.
```

- [ ] **Step 3: `README.md` — mục Bảo mật**

Thay hai đoạn ở dòng 187–192:

```markdown
SQLite + không đăng nhập là **quyết định có chủ đích** cho bối cảnh localhost một người: không
có middleware xác thực, mọi bản ghi mang một `LOCAL_USER_ID` cố định.

Hệ quả: bất kỳ ai chạm được cổng 3000 đều đọc/ghi được toàn bộ dữ liệu.
```

bằng:

```markdown
App có xác thực thật: phiên server-side (cookie `httpOnly`), CSRF double-submit, mật khẩu
Argon2id, khóa đăng nhập sau 5 lần sai trong 15 phút, và phân quyền theo vai trò
(`USER` / `ADMIN` / `SYSTEM_ADMIN`).

Hai lớp trực giao, cần cả hai: **RBAC** gác chức năng (`403`), **ownership** gác hàng dữ liệu
(`404`). `SYSTEM_ADMIN` có quyền `log:view` vẫn **không** đọc được nhật ký của người khác.

Bootstrap máy mới: `npm run seed:rbac` rồi (tùy chọn) `npm run seed:users`.

**Vẫn nên chỉ chạy localhost** cho tới khi có audit log cho thao tác phân quyền, và cho tới khi
cache quyền chuyển sang Redis nếu chạy nhiều tiến trình.
```

- [ ] **Step 4: Chạy test và commit**

Run: `npx vitest run test/docs/docsConsistency.test.ts`
Expected: chỉ còn dòng thuộc `docs/features/` và `docs/overview/06-open-questions.md`.

```bash
git add AGENTS.md README.md CLAUDE.md
git commit -m "docs: rewrite security section for the authenticated app"
```

---

## Task 5: SPEC và PLAN của bốn feature

**Files:**
- Modify: `docs/features/body-logs/SPEC.md:26,194-220` · `body-logs/PLAN.md:51`
- Modify: `docs/features/meals/SPEC.md:67,75,191,239` · `meals/PLAN.md:43`
- Modify: `docs/features/goal/SPEC.md:37` · `goal/PLAN.md:25,38`
- Modify: `docs/features/reminders/SPEC.md:114-116`
- Modify: `docs/features/meals/SPEC.md:197` · `docs/features/rbac/SPEC.md:192,589` · `docs/features/web-shell/PLAN.md:15,62,478`

> **Đây không chỉ là đổi tên hằng.** `meals/SPEC.md:239` viết *"Đúng một chỗ … repository không
> phải sửa một dòng nào"* — câu đó đã thành quá khứ và cần chuyển sang thì hoàn thành.
> `body-logs/SPEC.md:194` in code mẫu với chữ ký `whereKey(date)` mà bản thật là
> `whereKey(userId, date)`. Người đọc spec để sửa code sẽ viết sai chữ ký.

- [ ] **Step 1: `body-logs`**

Dòng 26, thay `mọi truy vấn mang `LOCAL_USER_ID`` bằng `mọi truy vấn mang `userId` (tham số đầu tiên của cả năm hàm)`.

Dòng 194–195, thay code mẫu:

```ts
  where:  { userId_date: { userId: LOCAL_USER_ID, date } },
  create: { userId: LOCAL_USER_ID, date, ...patch },
```

bằng:

```ts
  where:  { userId_date: { userId, date } },
  create: { userId, date, ...patch },
```

Dòng 211–220, thay cả khối bằng:

```markdown
không phải `date` một mình. `userId` là **tham số đầu tiên** của cả năm hàm repository:

- `findByDate(userId, date)` / `upsertByDate(userId, date, patch)` → `where: { userId_date: { userId, date } }`
- `findInRange(userId, from, to)` → `where: { userId, date: { gte, lte } }`
- `deleteByDate(userId, date)` → `where: { userId, date }`

Giá trị `userId` đến từ `req.user!.id`, do `requireAuth` gắn. `deleteMany` thay cho `delete` ở
hàm cuối vừa tránh phải bắt `P2025`, vừa **là lớp cách ly hàng**: `delete({ where: { date } })`
sẽ xóa bản ghi cùng ngày của người khác.
```

`PLAN.md:51`: thay `Mọi truy vấn mang `LOCAL_USER_ID`.` bằng `Mọi truy vấn mang `userId` — tham số đầu tiên.`

- [ ] **Step 2: `meals`**

Dòng 67: thay `của `LOCAL_USER_ID`` bằng `của người đang gọi`.

Dòng 75: thay `server gán từ `LOCAL_USER_ID` (`services/meals.service.ts:12,20`)` bằng
`server gán từ phiên (`req.user!.id`, truyền xuống service làm tham số đầu tiên)`.

Dòng 191, thay cả đoạn bằng:

```markdown
`userId` đến từ phiên đăng nhập, controller truyền xuống service làm tham số đầu tiên. **Mọi
truy vấn trong repository đều mang `userId`** — kể cả khi tra theo `id` vốn đã là khóa chính.
`Meal.id` là cuid toàn cục nên `where: { id }` trần chạm được bản ghi của người khác.
```

Dòng 239, thay cả đoạn bằng:

```markdown
**Đã làm (giai đoạn A).** Hàm `currentUserId()` bị xóa; bốn hàm service nhận `userId` làm tham
số đầu tiên. **Repository không phải sửa một dòng nào** — mọi hàm của nó đã nhận `userId` từ
đầu. Đó chính là khoản lãi của việc thêm cột `userId` ngay từ ngày đầu.
```

`PLAN.md:43`: xóa dòng `- `server/src/shared/constants.ts` — `LOCAL_USER_ID``.

- [ ] **Step 3: `goal`**

`SPEC.md:37`: thay `gắn `LOCAL_USER_ID`, map sang response DTO` bằng `nhận `userId` làm tham số đầu tiên, map sang response DTO`.

`PLAN.md:25`: thay `Gắn `LOCAL_USER_ID` (`:1,11,16`) — điểm duy nhất phải sửa khi thêm auth` bằng
`Nhận `userId` từ controller (đã đổi ở giai đoạn A — trước đó là hằng)`.

`PLAN.md:38`: xóa dòng `- `LOCAL_USER_ID` — `server/src/shared/constants.ts:9``.

- [ ] **Step 4: `reminders`**

Dòng 114–116, thay:

```markdown
`where: { userId_kind: { userId: LOCAL_USER_ID, kind } }`
…
thứ giữ cho dữ liệu vẫn đúng khi có auth: grep `LOCAL_USER_ID` ra đúng danh sách
```

bằng:

```markdown
`where: { userId_kind: { userId, kind } }` — không bao giờ tìm bằng `kind` trần, vì `kind` một
mình khớp hàng của **mọi** người dùng.

Scheduler là ngoại lệ có chủ đích: nó chạy từ cron nên không có phiên, và dùng
`findRemindersForAllUsers()` — một truy vấn lấy nhắc nhở đang bật của mọi user, mỗi hàng mang
`userId` để gửi đúng topic. Gửi nhầm topic ở đây là rò dữ liệu sức khỏe sang người lạ, nên có
suite riêng canh: `test/features/reminders/scheduler.multiUser.test.ts`.
```

- [ ] **Step 5: Chạy test và commit**

Run: `npx vitest run test/docs/docsConsistency.test.ts`
Expected: chỉ còn dòng thuộc `docs/overview/06-open-questions.md`.

```bash
git add docs/features/
git commit -m "docs(features): update specs to the post-auth repository signatures"
```

---

## Task 6: Đóng Q11–Q15 trong `06-open-questions.md`

**Files:**
- Modify: `docs/overview/06-open-questions.md` — bảng tóm tắt (dòng 24–52), năm mục Q11–Q15, và hai dòng 17, 269

> Năm câu hỏi này **đã có câu trả lời nằm trong code**. Để chúng ở mục "chưa chốt" khiến người
> đọc tưởng còn phải quyết, và tệ hơn: có thể quyết lại khác với thứ đã build.

- [ ] **Step 1: Sửa bảng tóm tắt**

Thay năm dòng Q11–Q15 bằng:

```markdown
| Q11 | SQLite + đăng nhập | **đã chốt** — giữ SQLite, auth đã làm xong | — |
| Q12 | Bao giờ bật auth, theo trình tự nào | **đã chốt** — giai đoạn A→D, xong 2026-08-28 | — |
| Q13 | Dữ liệu `userId = 'local'` migrate thế nào | **đã chốt** — không migrate, backfill `roleId` | — |
| Q14 | Đăng ký tự do hay chỉ admin tạo tài khoản | **đã chốt** — cả hai | — |
| Q15 | Admin có được xem dữ liệu sức khỏe người khác không | **đã chốt** — KHÔNG | — |
```

- [ ] **Step 2: Thêm khối trả lời vào đầu mỗi mục Q11–Q15**

Chèn ngay dưới mỗi tiêu đề `### Q1x. …`:

Q11:
```markdown
> **ĐÃ CHỐT (2026-08-28).** Giữ SQLite. Auth đã làm xong mà không đổi DB — với một tiến trình và
> vài người dùng, "một writer tại một thời điểm" chưa thành vấn đề. Điều kiện đổi sang Postgres
> giữ nguyên như phân tích bên dưới.
```

Q12:
```markdown
> **ĐÃ CHỐT (2026-08-28).** Trình tự là bốn giai đoạn A→D của
> `../superpowers/specs/2026-08-10-auth-rbac-3-roles-design.md` §10, đã chạy hết. `requireAuth`
> mắc một lần ở `app.ts`; 208 test cũ được sửa sang phiên thật trong cùng đợt (Task 10), không
> để lại giai đoạn nào test đỏ.
```

Q13:
```markdown
> **ĐÃ CHỐT (2026-08-28).** Không migrate hàng nào. DB thật lúc đó chưa có bản ghi
> `userId = 'local'` nào cần cứu, nên bước "backfill dữ liệu" của plan gốc bị bỏ. Việc còn lại
> chỉ là gán vai trò: `npm run seed:rbac` đặt `roleId` cho tài khoản chưa có — tài khoản cũ nhất
> nhận `SYSTEM_ADMIN`, còn lại nhận `USER`.
```

Q14:
```markdown
> **ĐÃ CHỐT (2026-08-28).** Cả hai đường đều có: `POST /api/auth/register` mở công khai (vai trò
> `USER` gán cứng phía server, không đọc từ body), và `POST /api/users` cho `user:manage`. Nợ đi
> kèm ghi tường minh ở design doc §7: **đăng ký mở mà không xác thực email thì form đăng ký chính
> là công cụ liệt kê tài khoản** — phải xử lý trước khi mở ra khỏi localhost.
```

Q15:
```markdown
> **ĐÃ CHỐT (2026-08-28) — KHÔNG.** Không vai trò nào đọc được dữ liệu sức khỏe của người khác,
> kể cả `SYSTEM_ADMIN`. `log:view` chỉ mở CHỨC NĂNG "xem nhật ký"; hàng nào hiện ra vẫn do
> ownership quyết định. Muốn đảo phải thêm một quyền MỚI (`log:view-any`) kèm log truy cập —
> không phải nâng quyền hiện có. Khóa bằng test: `test/features/userIsolation.test.ts` và ca
> "SYSTEM_ADMIN cũng KHÔNG đọc được dữ liệu người khác" trong `permissionGuard.test.ts`.
```

- [ ] **Step 3: Chạy test canh — lần này phải XANH**

Run: `npx vitest run test/docs/docsConsistency.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 4: Commit**

```bash
git add docs/overview/06-open-questions.md
git commit -m "docs(open-questions): close Q11-Q15, answered by shipped code"
```

---

## Task 7: Dọn nốt và verify toàn bộ

**Files:**
- Modify: `docs/superpowers/plans/2026-08-10-auth-backend-giai-doan-a.md` (checkbox Task 1–5)
- Modify: `docs/features/auth/PLAN.md` §Bước 3 (bước migrate đã bỏ)
- Modify: `docs/features/auth/SPEC.md` §10 (đánh dấu danh sách nợ đã trả)

- [ ] **Step 1: Tick checkbox Task 1–5 của plan giai đoạn A**

Code của Task 1–5 đã tồn tại từ trước phiên 2026-08-28 (commit `027845d`, `a43a60d`); chỉ có
checkbox chưa được tick. Dùng script để không sót:

```bash
cd C:/Project/WorkSpace/Lean
python - <<'PY'
p = 'docs/superpowers/plans/2026-08-10-auth-backend-giai-doan-a.md'
lines = open(p, encoding='utf-8').read().split('\n')
end = next(i for i, l in enumerate(lines) if l.startswith('## Task 6:'))
for i in range(end):
    if lines[i].startswith('- [ ] '):
        lines[i] = '- [x] ' + lines[i][6:]
open(p, 'w', encoding='utf-8').write('\n'.join(lines))
PY
grep -c "^- \[ \]" docs/superpowers/plans/2026-08-10-auth-backend-giai-doan-a.md
```

Expected: `0`.

- [ ] **Step 2: Sửa `auth/PLAN.md` §Bước 3 — bước migrate không còn tồn tại**

Design doc §12 liệt kê dòng này là sẽ sai. `auth/PLAN.md` §Bước 3 mô tả một bước backfill dữ liệu
`userId='local'` đã bị bỏ (quyết định 6). Chèn ngay dưới tiêu đề Bước 3:

```markdown
> **BỎ (2026-08-28).** Bước này giả định có sẵn bản ghi `userId = 'local'` cần cứu. DB thật không
> có bản ghi nào như vậy lúc bật auth, nên không migrate gì. Việc còn lại — gán vai trò cho tài
> khoản chưa có — nằm ở `npm run seed:rbac`. Xem `06-open-questions.md` Q13.
```

- [ ] **Step 3: Đánh dấu §10 của `auth/SPEC.md` là đã trả**

Chèn ngay dưới tiêu đề `## 10. Chỗ mâu thuẫn với tài liệu hiện có`:

```markdown
> **ĐÃ TRẢ XONG (2026-08-28).** Điều kiện *"không sửa file nào trong danh sách này khi chưa có
> code chạy"* đã thỏa: code chạy từ commit `9422401`. Mọi dòng trong bảng dưới đã được cập nhật,
> và `server/test/docs/docsConsistency.test.ts` canh để chúng không quay lại. Giữ nguyên bảng —
> nó ghi lại vì sao từng file phải sửa.
```

- [ ] **Step 4: Verify toàn bộ**

```bash
cd server
npx tsc --noEmit
npm test
```

Expected: tsc sạch; toàn bộ suite xanh, trong đó có `test/docs/docsConsistency.test.ts` 5/5.

Kiểm bằng tay một lần cuối:

```bash
cd C:/Project/WorkSpace/Lean
grep -rn "LOCAL_USER_ID" --include="*.md" . | grep -v node_modules | grep -v docs/archive | grep -v .superpowers | grep -v docs/features/auth | grep -v docs/superpowers
```

Expected: không kết quả nào.

- [ ] **Step 5: Commit và push**

```bash
git add docs/ 
git commit -m "docs(auth): mark the doc-debt list as settled"
git push origin main
```

---

## Ngoài phạm vi plan này

Hai đợt còn lại **không** viết plan được ở đây, vì plan phải argue từ một spec và hai đợt này
chưa có spec nào:

| Đợt | Thiếu gì trước khi lên plan được |
|---|---|
| `ui-mui` — chuyển UI kit sang MUI | Một design doc trả lời: giữ hay bỏ `components/ui/` hiện có (7 component, có test riêng)? MUI v7 + Emotion là ~300 KB thêm vào bundle của một app localhost — đổi lấy gì? CSS Module hiện tại đang chạy tốt và bám `tokens.css`; chuyển đổi là viết lại toàn bộ 20 file `.module.css`. **Cần brainstorming trước.** |
| `charts-mui` — `@mui/x-charts`, mỗi số đo một biểu đồ, tờ lịch tháng theo % tiến độ | Chặn bởi `ui-mui`. Ngoài ra cần chốt: "% tiến độ" tính theo công thức nào cho **năm** số đo (hiện `shared/stats/` chỉ có công thức cho cân nặng)? Tờ lịch tháng lấy màu theo ngưỡng nào? **Cần spec cho phần công thức trước khi vẽ.** |

Và bảy khiếm khuyết `D1`–`D7` ở `06-open-questions.md` đã được đặc tả đủ để làm ngay, nhưng
chúng là thay đổi **code** chứ không phải tài liệu — nên thuộc một plan riêng, không trộn vào
đợt này.
