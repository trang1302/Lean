import { useEffect, useRef, useState } from 'react';
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
  // Chốt chặn THẬT của "hai request chồng nhau" (§2.3, M2 báo cáo review) — `isSaving`
  // ở trên là STATE, nên hai lệnh gọi `save()` trong CÙNG một tick (trước khi React
  // commit) đều đọc cùng giá trị cũ và lọt qua cả hai. Ref đọc/ghi ĐỒNG BỘ, không đợi
  // render, nên chặn được cả ca đó — `isSaving` state vẫn giữ lại riêng để render nút.
  const isSavingRef = useRef(false);
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
    if (isSavingRef.current) return;
    if (!isDirty) return;

    const patch = buildPatch();
    // Mọi ô đã sửa đều là NaN → không còn gì hợp lệ để gửi.
    if (Object.keys(patch).length === 0) return;

    // Xoá lỗi cũ TRƯỚC khi gửi: lỗi tồn đọng của lần trước trên một ô đã sửa đúng
    // không được hiển thị trong lúc chờ.
    fieldErrors.reset();
    isSavingRef.current = true;
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
      isSavingRef.current = false;
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
