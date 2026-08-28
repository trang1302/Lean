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
