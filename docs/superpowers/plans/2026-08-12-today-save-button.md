# Kế hoạch triển khai `today-save-button`

> **Cho agent thực thi:** SKILL BẮT BUỘC — dùng `superpowers:subagent-driven-development`
> hoặc `superpowers:executing-plans`. Các bước dùng checkbox (`- [ ]`) để theo dõi.

**Mục tiêu:** Bỏ lưu-khi-blur ở khối "Số đo" trang Hôm nay, thay bằng nút Lưu tường minh,
và bịt ba đường mất dữ liệu mà thay đổi đó tạo ra.

**Kiến trúc:** `useBodyLogForm` đổi từ "commit từng ô khi blur" sang "gom các ô đã sửa,
gửi một request khi bấm Lưu". `BodyLogForm` đẩy cờ `isDirty` lên `TodayPage`, nơi đặt cả
ba lớp chặn (đổi ngày, điều hướng trong app, đóng tab).

**Stack:** React 19 · react-router 8 (`createBrowserRouter`) · TypeScript 7 · Vitest 4 + jsdom

**Spec nguồn:** `docs/superpowers/specs/2026-08-12-today-save-button-design.md`

---

## Global Constraints

- **KHÔNG chạy `git commit` / `git push`.** `CLAUDE.local.md` cấm. Kết thúc mỗi task là
  checkpoint báo cáo; chủ dự án tự commit.
- **KHÔNG `git stash` / `git checkout` / `git restore` / `git clean`** trên cây làm việc.
  Cần đọc bản gốc thì dùng `git show HEAD:<path>` (chỉ đọc).
- **KHÔNG đụng `server/`.** Hợp đồng API không đổi ở đợt này.
- **KHÔNG đụng `web/src/features/charts/` hay `web/src/features/settings/`.**
- **KHÔNG đụng khối Bữa ăn** (`MealList`, `MealQuickAddForm`, `CalorieSummaryCard`).
- `date` luôn là chuỗi `"YYYY-MM-DD"`.
- Indent 2 spaces, single quotes, có semicolon. Comment bằng tiếng Việt như code hiện có.
- `npm test` treo trong sandbox thì dùng `VITEST_POOL=threads` (lý do ở `web/vite.config.ts:27-30`).

---

## Cấu trúc file

| File | Trách nhiệm sau khi sửa |
|---|---|
| `web/src/features/today/hooks/useBodyLogForm.ts` | Gom trường đã sửa, gửi một request; `isDirty`/`isSaving`/`justSaved` |
| `web/src/features/today/hooks/useBodyLogForm.test.ts` | Viết lại quanh bất biến mới |
| `web/src/features/today/components/BodyLogForm.tsx` | Nút Lưu; bỏ `onBlur`; đẩy `isDirty` lên qua `onDirtyChange` |
| `web/src/features/today/components/BodyLogForm.module.css` | Style hàng nút |
| `web/src/features/today/components/BodyLogForm.test.tsx` | Ca cho nút Lưu |
| `web/src/features/today/components/TodayPage.tsx` | Ba lớp chặn |
| `web/src/features/today/components/TodayPage.test.tsx` | Bọc router; ca cho chặn đổi ngày |
| `docs/features/web-today/SPEC.md` | §4 và §5.1 |

**KHÔNG cần sửa:** `today.api.ts` (`BodyLogPatch` đã nhận nhiều khoá), `DatePicker.tsx`
(nó chỉ gọi `onChange`; phần hỏi xác nhận nằm ở `TodayPage`), `constants/measures.ts`.

---

## Task 1: `useBodyLogForm` — gom trường đã sửa, gửi một request

**Files:**
- Sửa: `web/src/features/today/hooks/useBodyLogForm.ts`
- Test: `web/src/features/today/hooks/useBodyLogForm.test.ts`

**Interfaces:**
- Produces: `UseBodyLogFormResult` với `values`, `onChange(field, value)`, `save()`,
  `isDirty`, `isSaving`, `justSaved`, `attemptTick`, `fieldErrors`. Task 2 dùng đúng các tên này.
  `onBlur` và `savedField` **biến mất**.

> **Đây là file nguy hiểm nhất repo.** Nó quyết định payload gửi đi, và endpoint dùng upsert
> 3 trạng thái: một khoá mang `null` nghĩa là **xoá** số đo đó. Gửi thừa một khoá rỗng là
> xoá dữ liệu người dùng không đụng tới, và **không có lỗi nào báo**.

- [ ] **Bước 1: Viết lại file test theo API mới**

Thay toàn bộ `web/src/features/today/hooks/useBodyLogForm.test.ts`:

```ts
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useBodyLogForm } from './useBodyLogForm';
import { ApiError } from '../../../types/api';
import type { BodyLog } from '../../../types/api';
import { MEASURE_FIELDS, type MeasureField } from '../../../constants/measures';

// Bất biến của file này (spec §2.1): payload chứa ĐÚNG những trường người dùng
// đã sửa, không hơn. Đây là bản kế thừa của luật "đúng một khoá" thời lưu-khi-blur
// — cùng một điều: đừng đụng vào thứ người ta không đụng.
//
// `bodyLog` phải tạo ĐÚNG MỘT LẦN ngoài factory của `renderHook`: hook có effect
// phụ thuộc `bodyLog` theo REFERENCE; object mới mỗi render sẽ làm effect chạy vô hạn.

const DATE = '2026-08-12';

function makeBodyLog(overrides: Partial<BodyLog> = {}): BodyLog {
  return {
    date: DATE,
    weightKg: null,
    waistCm: null,
    chestCm: null,
    shoulderCm: null,
    armCm: null,
    note: null,
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z',
    ...overrides,
  };
}

/** Ngày đã ghi đủ năm số đo — nền của mọi ca "không được đụng". */
const FULL = {
  weightKg: 72.4,
  waistCm: 88,
  chestCm: 98,
  shoulderCm: 112,
  armCm: 32,
} as const;

describe('useBodyLogForm — BẤT BIẾN: payload chứa đúng trường đã sửa', () => {
  it('sửa 2/5 ô → payload có đúng 2 khoá đó, không có 3 khoá kia', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog(FULL));
    const log = makeBodyLog(FULL);
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    act(() => result.current.onChange('chestCm', '99'));
    act(() => result.current.onChange('armCm', '33'));
    await act(async () => { await result.current.save(); });

    expect(put).toHaveBeenCalledTimes(1);
    const [, body] = put.mock.calls[0] as [string, Record<string, unknown>];
    expect(Object.keys(body).sort()).toEqual(['armCm', 'chestCm']);
    expect(body).toEqual({ chestCm: 99, armCm: 33 });
  });

  it.each(MEASURE_FIELDS)('sửa mình %s → payload chỉ có khoá đó', async (field: MeasureField) => {
    const put = vi.fn().mockResolvedValue(makeBodyLog(FULL));
    const log = makeBodyLog(FULL);
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    act(() => result.current.onChange(field, '50'));
    await act(async () => { await result.current.save(); });

    const [, body] = put.mock.calls[0] as [string, Record<string, unknown>];
    expect(Object.keys(body)).toEqual([field]);
  });
});

describe('useBodyLogForm — luật 1: không đổi thì không gửi', () => {
  it('không sửa gì mà bấm Lưu → không request nào', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog());
    const log = makeBodyLog(FULL);
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    await act(async () => { await result.current.save(); });

    expect(put).not.toHaveBeenCalled();
  });

  it('gõ "72.40" lên ô đang là 72.4 → không gửi (so numeric, không so chuỗi)', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog());
    const log = makeBodyLog({ weightKg: 72.4 });
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    act(() => result.current.onChange('weightKg', '72.40'));
    await act(async () => { await result.current.save(); });

    // PUT với patch không đổi vẫn bump `updatedAt` và có thể tạo bản ghi rỗng
    // cho ngày chưa có gì — đó là lý do luật này tồn tại, không phải hiệu năng.
    expect(put).not.toHaveBeenCalled();
  });
});

describe('useBodyLogForm — luật 2: xoá trắng ô đang có giá trị → gửi null', () => {
  it.each(MEASURE_FIELDS)('xoá trắng %s → { [field]: null }', async (field: MeasureField) => {
    const put = vi.fn().mockResolvedValue(makeBodyLog());
    const log = makeBodyLog(FULL);
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    act(() => result.current.onChange(field, ''));
    await act(async () => { await result.current.save(); });

    const [, body] = put.mock.calls[0] as [string, Record<string, unknown>];
    expect(body).toEqual({ [field]: null });
  });
});

describe('useBodyLogForm — NaN không được làm hỏng cả lần lưu', () => {
  it('một ô NaN, một ô hợp lệ → chỉ ô hợp lệ vào payload', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog());
    const log = makeBodyLog();
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    act(() => result.current.onChange('armCm', 'abc'));
    act(() => result.current.onChange('chestCm', '98'));
    await act(async () => { await result.current.save(); });

    const [, body] = put.mock.calls[0] as [string, Record<string, unknown>];
    expect(body).toEqual({ chestCm: 98 });
  });
});

describe('useBodyLogForm — isDirty', () => {
  it('tắt lúc đầu, bật khi gõ, TẮT LẠI sau khi lưu xong', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog({ chestCm: 98 }));
    const log = makeBodyLog();
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    expect(result.current.isDirty).toBe(false);

    act(() => result.current.onChange('chestCm', '98'));
    expect(result.current.isDirty).toBe(true);

    await act(async () => { await result.current.save(); });
    // Sai chỗ này thì nút Lưu sáng mãi sau khi đã lưu — spec §2.4.
    await waitFor(() => expect(result.current.isDirty).toBe(false));
  });

  it('gõ rồi gõ trả lại giá trị cũ → isDirty tắt', () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog());
    const log = makeBodyLog({ chestCm: 98 });
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    act(() => result.current.onChange('chestCm', '99'));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.onChange('chestCm', '98'));
    expect(result.current.isDirty).toBe(false);
  });
});

describe('useBodyLogForm — lưu hỏng', () => {
  it('400 → lỗi gắn vào đúng ô, isDirty VẪN true', async () => {
    const put = vi
      .fn()
      .mockRejectedValue(
        new ApiError(400, 'VALIDATION_ERROR', 'sai', [{ path: 'chestCm', message: 'quá lớn' }]),
      );
    const log = makeBodyLog();
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    act(() => result.current.onChange('chestCm', '9999'));
    await act(async () => { await result.current.save(); });

    await waitFor(() => expect(result.current.fieldErrors.fieldErrors['chestCm']).toBe('quá lớn'));
    // Chưa lưu được thì vẫn còn thay đổi chưa lưu — ba lớp chặn ở TodayPage
    // dựa vào cờ này, tắt nhầm là mất dữ liệu lúc rời trang.
    expect(result.current.isDirty).toBe(true);
    expect(result.current.attemptTick).toBeGreaterThan(0);
  });
});

describe('useBodyLogForm — chống bấm Lưu hai lần', () => {
  it('gọi save() lần hai khi lần một chưa xong → chỉ một request', async () => {
    let resolvePut: (v: BodyLog) => void = () => {};
    const put = vi.fn().mockImplementation(
      () => new Promise<BodyLog>((res) => { resolvePut = res; }),
    );
    const log = makeBodyLog();
    const { result } = renderHook(() => useBodyLogForm(DATE, log, put));

    act(() => result.current.onChange('chestCm', '98'));
    // `!` bắt buộc: TS không thấy được rằng callback của `act` chạy đồng bộ ngay,
    // nên nếu khai `let first: Promise<void>;` trần sẽ báo "used before assigned".
    let first!: Promise<void>;
    act(() => { first = result.current.save(); });
    await waitFor(() => expect(result.current.isSaving).toBe(true));
    await act(async () => { await result.current.save(); });

    expect(put).toHaveBeenCalledTimes(1);
    await act(async () => { resolvePut(makeBodyLog({ chestCm: 98 })); await first; });
  });
});

describe('useBodyLogForm — đồng bộ khi đổi ngày', () => {
  it('bodyLog mới thay cả 5 ô, isDirty về false', async () => {
    const put = vi.fn().mockResolvedValue(makeBodyLog());
    const first = makeBodyLog(FULL);
    const second = makeBodyLog({ date: '2026-08-13', weightKg: 70 });

    const { result, rerender } = renderHook(
      ({ date, log }: { date: string; log: BodyLog }) => useBodyLogForm(date, log, put),
      { initialProps: { date: DATE, log: first } },
    );

    act(() => result.current.onChange('chestCm', '99'));
    expect(result.current.isDirty).toBe(true);

    rerender({ date: '2026-08-13', log: second });

    await waitFor(() => expect(result.current.values.weightKg).toBe('70'));
    expect(result.current.values.chestCm).toBe('');
    expect(result.current.isDirty).toBe(false);
  });
});
```

- [ ] **Bước 2: Chạy test, xác nhận ĐỎ**

Chạy: `cd web && VITEST_POOL=threads npx vitest run src/features/today/hooks/useBodyLogForm.test.ts`
Kỳ vọng: FAIL với `result.current.save is not a function` (hook cũ có `onBlur`, không có `save`).

**Dán output đỏ thật vào báo cáo.** Mô tả bằng suy luận không chứng minh được test có thể đỏ.

- [ ] **Bước 3: Viết lại `useBodyLogForm.ts`**

```ts
import { useEffect, useState } from 'react';
import { ApiError } from '../../../types/api';
import { useFieldErrors, type UseFieldErrorsResult } from '../../../hooks/useFieldErrors';
import type { BodyLog } from '../../../types/api';
import { MEASURE_FIELDS, type MeasureField } from '../../../constants/measures';
import { putBodyLog as defaultPutBodyLog, type BodyLogPatch } from '../api/today.api';

const KNOWN_FIELDS: readonly string[] = MEASURE_FIELDS;

type MeasureRecord<T> = Record<MeasureField, T>;

function fillRecord<T>(value: T): MeasureRecord<T> {
  return Object.fromEntries(MEASURE_FIELDS.map((field) => [field, value])) as MeasureRecord<T>;
}

/** Chuỗi hiển thị cho mỗi ô, lấy từ bản ghi server. `null` → ô rỗng. */
function valuesFromLog(bodyLog: BodyLog | null): MeasureRecord<string> {
  return Object.fromEntries(
    MEASURE_FIELDS.map((field) => {
      const value = bodyLog?.[field];
      return [field, value == null ? '' : String(value)];
    }),
  ) as MeasureRecord<string>;
}

/**
 * So NUMERIC, không so chuỗi: "72.40" và "72.4" là CÙNG một giá trị, nên gõ lại
 * cùng số dưới dạng khác không được tính là thay đổi.
 */
function isUnchanged(raw: string, loadedValue: string): boolean {
  const rawEmpty = raw.trim() === '';
  const loadedEmpty = loadedValue.trim() === '';
  if (rawEmpty && loadedEmpty) return true;
  if (rawEmpty !== loadedEmpty) return false;
  return Number(raw) === Number(loadedValue);
}

export interface UseBodyLogFormResult {
  values: MeasureRecord<string>;
  onChange: (field: MeasureField, value: string) => void;
  /** Gom các ô ĐÃ SỬA thành MỘT request. Không có gì để gửi thì không gửi. */
  save: () => Promise<void>;
  /** Có ô nào khác giá trị đã nạp. Điều khiển nút Lưu và cả ba lớp chặn ở `TodayPage`. */
  isDirty: boolean;
  isSaving: boolean;
  /** Vừa lưu xong — hiện "Đã lưu ✓". Tắt khi gõ tiếp hoặc đổi ngày. */
  justSaved: boolean;
  /** Tăng sau mỗi lần lưu hoàn tất (thành công hoặc lỗi) — `BodyLogForm` dùng để
   * biết "vừa có một lần submit mới" và tự đưa focus về ô lỗi đầu tiên. */
  attemptTick: number;
  fieldErrors: UseFieldErrorsResult;
}

/**
 * State + hành vi của `BodyLogForm`. Đây là chỗ rủi ro nhất của cả web: endpoint
 * dùng upsert 3 trạng thái, nên một khoá mang `null` nghĩa là XOÁ số đo đó. Gửi
 * thừa một khoá rỗng là xoá dữ liệu người dùng không đụng tới, và KHÔNG có lỗi nào báo.
 *
 * BẤT BIẾN (spec §2.1): payload chứa ĐÚNG những trường người dùng đã sửa, không hơn.
 *
 * Hai luật quyết định một trường có vào payload hay không:
 * 1. không đổi so với lúc nạp (so NUMERIC) → KHÔNG vào. `PUT` với patch không đổi
 *    vẫn bump `updatedAt` và có thể tạo bản ghi rỗng cho ngày chưa có gì.
 * 2. xoá trắng ô trước đó có giá trị → vào payload là `null` (xoá).
 * Cộng: giá trị `NaN` → bỏ qua ĐÚNG ô đó, các ô hợp lệ khác vẫn được gửi.
 *
 * Luật cũ "chưa động vào ô thì không gửi" đã TAN vào luật 1 — một ô chưa ai chạm có
 * `values[f] === loaded[f]`. Cờ `touched` vì thế bị xoá: nó không còn phân biệt được
 * ca nào, và giữ một cờ không phân biệt được gì là để lại thứ người sau tưởng quan trọng.
 *
 * `loaded` là STATE chứ không phải ref: `isDirty` phải tính lại sau mỗi lần lưu thành
 * công, mà gán vào ref không gây re-render nên nút Lưu sẽ sáng mãi.
 */
export function useBodyLogForm(
  date: string,
  bodyLog: BodyLog | null,
  putBodyLog: (date: string, patch: BodyLogPatch) => Promise<BodyLog> = defaultPutBodyLog,
): UseBodyLogFormResult {
  const [values, setValues] = useState<MeasureRecord<string>>(() => fillRecord(''));
  const [loaded, setLoaded] = useState<MeasureRecord<string>>(() => fillRecord(''));
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [attemptTick, setAttemptTick] = useState(0);

  const fieldErrors = useFieldErrors(KNOWN_FIELDS);

  useEffect(() => {
    const next = valuesFromLog(bodyLog);
    setValues(next);
    setLoaded(next);
    setJustSaved(false);
    fieldErrors.reset();
    // `fieldErrors.reset` là hàm ổn định (useCallback rỗng deps) — không cần deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, bodyLog]);

  const isDirty = MEASURE_FIELDS.some((field) => !isUnchanged(values[field], loaded[field]));

  /** Các trường sẽ gửi. Tính tại chỗ gọi để không bao giờ lệch khỏi `isDirty`. */
  function buildPatch(): BodyLogPatch {
    const patch: BodyLogPatch = {};
    for (const field of MEASURE_FIELDS) {
      if (isUnchanged(values[field], loaded[field])) continue; // luật 1
      const raw = values[field];
      if (raw.trim() === '') {
        patch[field] = null; // luật 2 — xoá
        continue;
      }
      const num = Number(raw);
      if (Number.isNaN(num)) continue; // bỏ qua đúng ô này, không hỏng cả lần lưu
      patch[field] = num;
    }
    return patch;
  }

  async function save(): Promise<void> {
    // Chốt chặn nằm TRONG hook, không chỉ ở `disabled` của nút: hai request chồng
    // nhau trên cùng một PUT upsert ghi đè lẫn nhau theo thứ tự PHẢN HỒI.
    if (isSaving) return;
    if (!isDirty) return;

    const patch = buildPatch();
    // Mọi ô đã sửa đều là NaN → không còn gì hợp lệ để gửi.
    if (Object.keys(patch).length === 0) return;

    // Xoá lỗi cũ TRƯỚC khi gửi: lỗi tồn đọng của lần trước trên một ô đã sửa đúng
    // không được hiển thị trong lúc chờ.
    fieldErrors.reset();
    setIsSaving(true);
    setJustSaved(false);

    try {
      await putBodyLog(date, patch);
      // Chỉ những ô THỰC SỰ gửi mới được coi là đã lưu. Ô NaN vẫn còn lệch, nên
      // `isDirty` vẫn đúng là `true` sau đó — người dùng còn thứ chưa lưu thật.
      setLoaded((prev) => {
        const next = { ...prev };
        for (const field of Object.keys(patch) as MeasureField[]) next[field] = values[field];
        return next;
      });
      setJustSaved(true);
    } catch (err) {
      if (err instanceof ApiError) {
        fieldErrors.setError(err);
      } else {
        throw err;
      }
    } finally {
      setIsSaving(false);
      setAttemptTick((t) => t + 1);
    }
  }

  return {
    values,
    isDirty,
    isSaving,
    justSaved,
    attemptTick,
    fieldErrors,
    save,
    onChange: (field: MeasureField, value: string) => {
      setJustSaved(false);
      setValues((prev) => ({ ...prev, [field]: value }));
    },
  };
}
```

- [ ] **Bước 4: Chạy test, xác nhận XANH**

Chạy: `cd web && VITEST_POOL=threads npx vitest run src/features/today/hooks/useBodyLogForm.test.ts`
Kỳ vọng: PASS toàn bộ. Output sạch, không `act()` warning.

- [ ] **Bước 5: CHECKPOINT** — báo cáo kèm output RED và GREEN thật, chờ chủ dự án commit.

---

## Task 2: `BodyLogForm` — nút Lưu, bỏ `onBlur`, đẩy `isDirty` lên

**Files:**
- Sửa: `web/src/features/today/components/BodyLogForm.tsx`
- Sửa: `web/src/features/today/components/BodyLogForm.module.css`
- Test: `web/src/features/today/components/BodyLogForm.test.tsx`

**Interfaces:**
- Consumes: `UseBodyLogFormResult` từ Task 1.
- Produces: prop mới `onDirtyChange?: (isDirty: boolean) => void`. Task 3 dùng nó.

- [ ] **Bước 1: Viết test đỏ**

Thêm vào `BodyLogForm.test.tsx` (giữ nguyên các `describe` sẵn có):

```tsx
describe('BodyLogForm — nút Lưu', () => {
  it('render nút Lưu, disabled khi chưa sửa gì', async () => {
    render(<BodyLogForm date="2026-08-12" bodyLog={null} isLoading={false} />);

    const btn = screen.getByRole('button', { name: /Lưu số đo/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('gõ vào một ô → nút Lưu bật', async () => {
    const user = userEvent.setup();
    render(<BodyLogForm date="2026-08-12" bodyLog={null} isLoading={false} />);

    await user.type(screen.getByLabelText('Vòng ngực (cm)'), '98');

    expect((screen.getByRole('button', { name: /Lưu số đo/i }) as HTMLButtonElement).disabled)
      .toBe(false);
  });

  it('báo isDirty lên trang gọi qua onDirtyChange', async () => {
    const onDirtyChange = vi.fn();
    const user = userEvent.setup();
    render(
      <BodyLogForm
        date="2026-08-12"
        bodyLog={null}
        isLoading={false}
        onDirtyChange={onDirtyChange}
      />,
    );

    await user.type(screen.getByLabelText('Vòng ngực (cm)'), '98');

    // Trang gọi cần cờ này để chặn đổi ngày khi còn thay đổi chưa lưu.
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
  });

  it('rời ô KHÔNG còn tự lưu — chỉ nút mới lưu', async () => {
    const user = userEvent.setup();
    render(<BodyLogForm date="2026-08-12" bodyLog={null} isLoading={false} />);

    await user.type(screen.getByLabelText('Vòng ngực (cm)'), '98');
    await user.tab();

    // Sau khi blur mà vẫn còn "chưa lưu" nghĩa là lưu-khi-blur đã thật sự bị bỏ.
    expect((screen.getByRole('button', { name: /Lưu số đo/i }) as HTMLButtonElement).disabled)
      .toBe(false);
  });
});
```

Nếu file chưa import `userEvent`/`waitFor`/`vi`, thêm:
`import userEvent from '@testing-library/user-event';` và bổ sung `waitFor`, `vi` vào import sẵn có.

- [ ] **Bước 2: Chạy test, xác nhận ĐỎ**

Chạy: `cd web && VITEST_POOL=threads npx vitest run src/features/today/components/BodyLogForm.test.tsx`
Kỳ vọng: FAIL — không tìm thấy nút tên `Lưu số đo`. **Dán output thật.**

- [ ] **Bước 3: Sửa `BodyLogForm.tsx`**

Thêm `Button` vào import từ `components/ui`, thêm `useEffect` cho `onDirtyChange`, bỏ mọi
`onBlur`, thêm hàng nút:

```tsx
import { useEffect, useRef } from 'react';
import { Button, Card, NumberInput } from '../../../components/ui';
```

```tsx
interface BodyLogFormProps {
  date: string;
  bodyLog: BodyLog | null;
  /** Trong lúc tải, `useApiResource` còn giữ dữ liệu ngày CŨ để tránh nhấp nháy —
   * disable cả năm ô để không ai gõ vào giá trị của ngày cũ rồi bấm Lưu cho ngày mới. */
  isLoading: boolean;
  /** Báo lên trang gọi khi có/hết thay đổi chưa lưu. `TodayPage` dùng để chặn
   * đổi ngày, chặn điều hướng, và cảnh báo khi đóng tab (spec §3). */
  onDirtyChange?: (isDirty: boolean) => void;
}
```

Trong thân component, sau khối `useEffect` focus hiện có:

```tsx
  // Đẩy cờ lên trang gọi. Hook không tự làm được: nó không biết ai đang dùng nó.
  useEffect(() => {
    onDirtyChange?.(form.isDirty);
  }, [form.isDirty, onDirtyChange]);
```

Bỏ `onBlur={...}` khỏi **cả hai** chỗ `NumberInput` (ô cân nặng và bốn ô trong `.map`).

Thay đoạn `<p className={s.hint}>` cuối bằng:

```tsx
      <div className={s.actions}>
        <Button onClick={() => void form.save()} disabled={!form.isDirty || form.isSaving}>
          {form.isSaving ? 'Đang lưu…' : 'Lưu số đo'}
        </Button>
        <span className={s.hint} aria-live="polite">
          {form.justSaved
            ? 'Đã lưu ✓'
            : form.isDirty
              ? 'Có thay đổi chưa lưu.'
              : 'Để trống một ô rồi bấm Lưu để xóa giá trị.'}
        </span>
      </div>
```

Và sửa docstring đầu component: bỏ câu "lưu khi blur — không có nút Lưu (SPEC §4)", thay
bằng mô tả đúng (lưu bằng nút; hook quyết định trường nào vào payload).

- [ ] **Bước 4: Thêm `.actions` vào `BodyLogForm.module.css`**

```css
.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  flex-wrap: wrap;
}
```

- [ ] **Bước 5: Chạy test file này, xác nhận XANH**

Chạy: `cd web && VITEST_POOL=threads npx vitest run src/features/today/components/BodyLogForm.test.tsx`
Kỳ vọng: PASS. Ca cũ khẳng định cả 5 ô `disabled` khi `isLoading` phải **vẫn xanh**.

- [ ] **Bước 6: CHECKPOINT** — báo cáo kèm output, chờ chủ dự án commit.

---

## Task 3: `TodayPage` — ba lớp chặn + tài liệu

**Files:**
- Sửa: `web/src/features/today/components/TodayPage.tsx`
- Test: `web/src/features/today/components/TodayPage.test.tsx`
- Sửa: `docs/features/web-today/SPEC.md`

**Interfaces:**
- Consumes: `onDirtyChange` từ Task 2.

- [ ] **Bước 1: Viết test đỏ**

`useBlocker` **đòi context của data router** — không bọc thì mọi test trong file này ném lỗi.
Thêm helper và ca mới vào `TodayPage.test.tsx`:

```tsx
import { createMemoryRouter, RouterProvider } from 'react-router';

/** `TodayPage` gọi `useBlocker`, hook này chỉ chạy trong data router. Render trần
 * sẽ ném lỗi — mọi ca trong file này phải đi qua đây. */
function renderTodayPage() {
  const router = createMemoryRouter([{ path: '/', element: <TodayPage /> }], {
    initialEntries: ['/'],
  });
  return render(<RouterProvider router={router} />);
}

describe('TodayPage — chặn đổi ngày khi còn thay đổi chưa lưu', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('đang sạch → đổi ngày KHÔNG hỏi', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderTodayPage();

    await screen.findByLabelText('Ngày');
    await user.clear(screen.getByLabelText('Ngày'));
    await user.type(screen.getByLabelText('Ngày'), '2026-08-10');

    // Hỏi thừa thì người dùng sẽ bấm bừa, và lớp chặn mất tác dụng.
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('đang bẩn, bấm HUỶ → ngày KHÔNG đổi', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    renderTodayPage();

    await screen.findByLabelText('Vòng ngực (cm)');
    await user.type(screen.getByLabelText('Vòng ngực (cm)'), '98');

    const dateInput = screen.getByLabelText('Ngày') as HTMLInputElement;
    const before = dateInput.value;
    await user.clear(dateInput);
    await user.type(dateInput, '2026-08-10');

    expect(confirmSpy).toHaveBeenCalled();
    // Ca dễ sai nhất cả đợt: hỏi rồi vẫn đổi = mất dữ liệu ĐÚNG LÚC người dùng
    // vừa nói là không muốn mất.
    expect((screen.getByLabelText('Ngày') as HTMLInputElement).value).toBe(before);
  });

  it('đang bẩn, bấm ĐỒNG Ý → ngày đổi', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderTodayPage();

    await screen.findByLabelText('Vòng ngực (cm)');
    await user.type(screen.getByLabelText('Vòng ngực (cm)'), '98');

    const dateInput = screen.getByLabelText('Ngày') as HTMLInputElement;
    await user.clear(dateInput);
    await user.type(dateInput, '2026-08-10');

    await waitFor(() =>
      expect((screen.getByLabelText('Ngày') as HTMLInputElement).value).toBe('2026-08-10'),
    );
  });
});
```

Đổi mọi lời gọi `render(<TodayPage />)` sẵn có trong file thành `renderTodayPage()`.

- [ ] **Bước 2: Chạy test, xác nhận ĐỎ**

Chạy: `cd web && VITEST_POOL=threads npx vitest run src/features/today/components/TodayPage.test.tsx`
Kỳ vọng: FAIL — chưa có gì gọi `confirm`. **Dán output thật.**

- [ ] **Bước 3: Sửa `TodayPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useBlocker } from 'react-router';
```

Trong thân `TodayPage`, sau `const data = useTodayData(date);`:

```tsx
  const [isDirty, setIsDirty] = useState(false);

  const CONFIRM_LEAVE = 'Có thay đổi chưa lưu ở khối Số đo. Vẫn rời đi?';

  /** Lớp chặn 1 — đổi ngày. `useBlocker` KHÔNG bắt được ca này: đổi `date` không
   * phải một lần điều hướng, không có URL nào thay đổi. */
  function handleDateChange(next: string) {
    if (isDirty && !window.confirm(CONFIRM_LEAVE)) return;
    setDate(next);
  }

  /** Lớp chặn 2 — điều hướng trong app (bấm sang Biểu đồ / Cài đặt). */
  const blocker = useBlocker(useCallback(() => isDirty, [isDirty]));

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    // `useBlocker` không tự hiện hộp thoại — nó chỉ dừng điều hướng và giao lại
    // quyết định. Dùng `confirm` thay vì dựng modal riêng: dự án chưa có component
    // dialog nào, dựng một cái cho đúng một chỗ dùng là abstraction thừa.
    if (window.confirm(CONFIRM_LEAVE)) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  /** Lớp chặn 3 — đóng tab / tải lại. Trình duyệt tự hiện cảnh báo mặc định;
   * nội dung thông báo không tuỳ biến được và đó là chủ đích của trình duyệt. */
  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);
```

Đổi hai chỗ trong JSX:

```tsx
      <DatePicker value={date} onChange={handleDateChange} />
```

```tsx
        <BodyLogForm
          date={date}
          bodyLog={data.bodyLog}
          isLoading={data.bodyLogLoading}
          onDirtyChange={setIsDirty}
        />
```

- [ ] **Bước 4: Chạy test file này, xác nhận XANH**

Chạy: `cd web && VITEST_POOL=threads npx vitest run src/features/today/components/TodayPage.test.tsx`
Kỳ vọng: PASS, gồm cả các ca cũ đã bọc router.

- [ ] **Bước 5: Chạy cả suite + typecheck**

Chạy: `cd web && VITEST_POOL=threads npm test && npx tsc -p tsconfig.json --noEmit`
Kỳ vọng: PASS, 0 lỗi kiểu.

- [ ] **Bước 6: Cập nhật `docs/features/web-today/SPEC.md`**

| Mục | Sửa gì |
|---|---|
| §4 | Bỏ "lưu khi blur — không có nút Lưu". Mô tả nút Lưu và ba trạng thái chữ bên cạnh (chưa lưu / đang lưu / đã lưu). |
| §5.1 | Bốn luật gửi → **hai** luật + luật NaN. Ghi bất biến mới: *payload chứa đúng những trường đã sửa*. Ghi vì sao `touched` biến mất. Ghi ba lớp chặn và vì sao cần cả ba. |

Viết đúng **hành vi thật của code**, không viết ý định. `docs/README.md` quy định code và
tài liệu lệch nhau thì code đúng.

- [ ] **Bước 7: CHECKPOINT CUỐI**

Báo cáo: output 2 lệnh Bước 5; danh sách file đã sửa; xác nhận `server/` và các feature
khác không bị đụng (`git status --short`). Chờ chủ dự án commit.

---

## Phụ lục: những chỗ CỐ Ý không làm

- **`DatePicker.tsx` không đổi** — nó chỉ gọi `onChange`; phần hỏi xác nhận thuộc `TodayPage`,
  nơi có `isDirty`. Nhét `confirm` vào `DatePicker` là buộc một control nhập liệu phải biết
  về trạng thái lưu của một form khác.
- **`today.api.ts` không đổi** — `BodyLogPatch` vốn đã nhận nhiều khoá.
- **Không thêm nút "Huỷ thay đổi"** — chưa ai yêu cầu.
- **Không đụng khối Bữa ăn** — `MealQuickAddForm` có nút riêng, lưu ngay, không có khái niệm
  "chưa lưu".
- **Không dựng component modal** — xem spec §3.1.
