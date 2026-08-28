/**
 * Map endpoint → mã quyền, khai TẬP TRUNG ở đúng một chỗ (nguyên tắc 2 của
 * upip, giữ nguyên tên `PermissionRegistry`).
 *
 * Đây là bảng §7 của docs/features/rbac/SPEC.md dưới dạng code. Muốn trả lời
 * "ai được gọi endpoint X" thì đọc mảng này, không phải đọc hết controller.
 *
 * HÀM THUẦN: không DB, không HTTP, không cache. Nó chỉ nói endpoint đòi mã
 * quyền nào; ai được cấp mã đó là việc của `permissionGuard`.
 *
 * **THỨ TỰ CÁC DÒNG LÀ MỘT PHẦN CỦA ĐẶC TẢ, KHÔNG PHẢI THẨM MỸ.** Khớp dòng
 * đầu tiên thắng, nên dòng HẸP phải đứng trước dòng RỘNG. Hai ràng buộc chết
 * người, cả hai đều có test canh ở `test/shared/rbac/permissionRegistry.test.ts`:
 *
 *   1. `/health` và `/auth/**` phải đứng ĐẦU — bị luật rộng khớp trước thì
 *      `/api/auth/login` yêu cầu đăng nhập để đăng nhập.
 *   2. `/users/*​/role` (`rbac:manage`) phải đứng TRƯỚC `/users/*` (`user:manage`)
 *      — đảo lại thì đổi vai trò chỉ cần `user:manage`, tức ai quản lý được tài
 *      khoản là tự nâng mình lên `SYSTEM_ADMIN`.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface Rule {
  /** `'ANY'` khớp mọi method. */
  readonly methods: readonly HttpMethod[] | 'ANY';
  /** Pattern dưới `/api`. `*` khớp MỘT đoạn, `**` khớp nhiều đoạn (kể cả rỗng). */
  readonly path: string;
  /** `null` = route mở, không cần đăng nhập, không cần quyền. */
  readonly permission: string | null;
}

export interface Resolution {
  /**
   * `false` = không luật nào khớp. Guard dịch thành 403 (mặc định TỪ CHỐI,
   * SPEC §6.4) — cố ý khác upip, vốn cho qua mọi path đã đăng nhập.
   */
  readonly matched: boolean;
  readonly permission: string | null;
}

const NOT_MATCHED: Resolution = { matched: false, permission: null };

export const PERMISSION_RULES: readonly Rule[] = [
  // ── Mở: phải đứng đầu ────────────────────────────────────────────────────
  { methods: 'ANY', path: '/health', permission: null },
  { methods: 'ANY', path: '/auth/**', permission: null },

  // ── Năm router dữ liệu ───────────────────────────────────────────────────
  { methods: ['GET'], path: '/body-logs', permission: 'log:view' },
  { methods: ['GET'], path: '/body-logs/*', permission: 'log:view' },
  { methods: ['PUT', 'DELETE'], path: '/body-logs/*', permission: 'log:manage' },

  { methods: ['GET'], path: '/meals', permission: 'log:view' },
  { methods: ['POST'], path: '/meals', permission: 'log:manage' },
  { methods: ['PATCH', 'DELETE'], path: '/meals/*', permission: 'log:manage' },

  { methods: ['GET'], path: '/summary', permission: 'log:view' },

  { methods: ['GET'], path: '/goal', permission: 'goal:view' },
  { methods: ['PUT'], path: '/goal', permission: 'goal:manage' },

  { methods: ['GET'], path: '/reminders', permission: 'reminder:view' },
  { methods: ['PUT'], path: '/reminders/*', permission: 'reminder:manage' },

  // ── Quản trị phân quyền ──────────────────────────────────────────────────
  { methods: ['GET'], path: '/permissions', permission: 'rbac:view' },
  { methods: ['GET'], path: '/roles', permission: 'rbac:view' },
  { methods: ['GET'], path: '/roles/*/permissions', permission: 'rbac:view' },
  { methods: ['PUT'], path: '/roles/*/permissions', permission: 'rbac:manage' },

  // PHẢI đứng trước hai dòng `/users/*` bên dưới — xem docstring đầu file.
  { methods: ['PUT'], path: '/users/*/role', permission: 'rbac:manage' },

  // ── Quản trị tài khoản ───────────────────────────────────────────────────
  { methods: ['GET'], path: '/users', permission: 'user:view' },
  { methods: ['GET'], path: '/users/*', permission: 'user:view' },
  { methods: ['POST'], path: '/users', permission: 'user:manage' },
  { methods: ['POST'], path: '/users/*/password', permission: 'user:manage' },
  { methods: ['PATCH', 'DELETE'], path: '/users/*', permission: 'user:manage' },
];

/** `/a/b/` và `//a/b` cùng ra `['a','b']` — dấu `/` thừa không được đổi kết quả. */
function segments(path: string): string[] {
  return path.split('/').filter((segment) => segment !== '');
}

/**
 * `*` khớp đúng MỘT đoạn; `**` khớp phần đuôi còn lại (kể cả rỗng) và chỉ hợp
 * lệ ở cuối pattern.
 */
function matchSegments(pattern: string, seg: readonly string[]): boolean {
  const pat = segments(pattern);

  for (let i = 0; i < pat.length; i += 1) {
    if (pat[i] === '**') return true; // nuốt phần còn lại
    if (i >= seg.length) return false;
    if (pat[i] === '*') continue;
    if (pat[i] !== seg[i]) return false;
  }

  return pat.length === seg.length;
}

function matchMethod(rule: Rule, method: string): boolean {
  return rule.methods === 'ANY' || rule.methods.includes(method.toUpperCase() as HttpMethod);
}

/**
 * Bỏ đoạn `/api` đầu nếu có.
 *
 * Guard được cắm bằng `app.use('/api', ...)` nên `req.path` đã là đường dẫn
 * tương đối. Vẫn cắt phòng hờ ở đây để hàm cho cùng kết quả dù nhận
 * `/api/goal` hay `/goal` — một hàm thuần mà đổi kết quả theo chỗ cắm
 * middleware là một cái bẫy, và nó đã sập một lần rồi.
 */
function stripApiPrefix(segments: string[]): string[] {
  return segments[0] === 'api' ? segments.slice(1) : segments;
}

/** `path` nhận cả `/goal` lẫn `/api/goal`. */
export function resolvePermission(method: string, path: string): Resolution {
  const seg = stripApiPrefix(segments(path));
  const rule = PERMISSION_RULES.find((r) => matchMethod(r, method) && matchSegments(r.path, seg));
  if (!rule) return NOT_MATCHED;
  return { matched: true, permission: rule.permission };
}
