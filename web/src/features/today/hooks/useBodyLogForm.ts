import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../types/api';
import { useFieldErrors, type UseFieldErrorsResult } from '../../../hooks/useFieldErrors';
import type { BodyLog } from '../../../types/api';
import { putBodyLog as defaultPutBodyLog, type BodyLogPatch } from '../api/today.api';

type NumericField = 'weightKg' | 'waistCm';

const KNOWN_FIELDS: readonly string[] = ['weightKg', 'waistCm'];

export interface UseBodyLogFormResult {
  weightValue: string;
  waistValue: string;
  onWeightChange: (value: string) => void;
  onWaistChange: (value: string) => void;
  onWeightBlur: () => void;
  onWaistBlur: () => void;
  /** `weightKg` | `waistCm` ngay sau khi ô đó vừa lưu thành công, `null`
   * sau đó (đổi ngày, hoặc ô khác vừa lưu). Chỉ để hiển thị "Đã lưu ✓" —
   * KHÔNG phải cờ đang lưu (không có request nào chạy song song ở form
   * này vì mỗi lần blur chỉ động vào đúng một ô, SPEC §5.1). */
  savedField: NumericField | null;
  /** Tăng dần mỗi lần một lần lưu (thành công hoặc lỗi) hoàn tất — trang
   * gọi dùng để biết "vừa có một lần submit mới" và tự đưa focus về ô lỗi
   * đầu tiên (B3 điều phối viên: `FieldError`/`useFieldErrors` cố ý không
   * tự làm side-effect DOM). */
  attemptTick: number;
  fieldErrors: UseFieldErrorsResult;
}

/**
 * State + hành vi của `BodyLogForm` — hiện thực đúng SPEC §5.1 (upsert 3
 * trạng thái) và §5.2 (lỗi 400 gắn vào đúng ô). Đây là bước rủi ro nhất
 * của cả feature (PLAN §4 bước 3): gửi sai một khóa là XÓA MẤT dữ liệu
 * người dùng không đụng tới.
 *
 * Ba mảnh state giữ cho MỖI ô (`weightKg`, `waistCm`):
 * 1. giá trị đang gõ trên input (chuỗi thô, hiển thị trực tiếp);
 * 2. giá trị ĐÃ NẠP từ server lúc đồng bộ gần nhất (so sánh trước khi gửi);
 * 3. cờ "người dùng đã động vào ô này chưa" (ref, không phải state — chỉ
 *    cần đọc lúc blur, không cần re-render khi đổi).
 *
 * Luật gửi khi blur (SPEC §5.1):
 * - chưa từng động vào ô → KHÔNG gửi, bất kể giá trị (ô rỗng ngay từ đầu
 *   và người dùng không gõ gì khác "rỗng vì vừa bị xóa trắng");
 * - giá trị hiện tại (so numeric, không so chuỗi thô — "72.40" và "72.4"
 *   là CÙNG một giá trị) không đổi so với lúc nạp → KHÔNG gửi. Không phải
 *   vì hiệu năng: `PUT` với patch không đổi vẫn bump `updatedAt` và có thể
 *   tạo bản ghi rỗng cho ngày chưa có gì (SPEC §5.1 quy tắc 1);
 * - ô vừa bị xóa trắng (trước đó có giá trị) → gửi `{ [field]: null }`;
 * - ô có giá trị mới, hợp lệ (không `NaN`) → gửi `{ [field]: Number(raw) }`.
 *
 * Đồng bộ lại CẢ BA mảnh state mỗi khi `date` đổi HOẶC `bodyLog` đổi
 * (effect deps `[date, bodyLog]`) — bao gồm cả lúc `bodyLog` tạm thời còn
 * là dữ liệu của ngày CŨ trong khi request của ngày MỚI đang chạy
 * (`useApiResource` cố ý giữ `data` cũ để tránh nhấp nháy, xem docstring
 * của nó). Trang gọi (`BodyLogForm`) PHẢI disable hai ô trong lúc
 * `isLoading`, để không ai gõ/blur vào giá trị của ngày cũ rồi gán nhầm
 * cho ngày mới — hook này không tự chặn được việc đó vì nó không biết
 * `isLoading`.
 */
export function useBodyLogForm(
  date: string,
  bodyLog: BodyLog | null,
  putBodyLog: (date: string, patch: BodyLogPatch) => Promise<BodyLog> = defaultPutBodyLog,
): UseBodyLogFormResult {
  const [weightValue, setWeightValue] = useState('');
  const [waistValue, setWaistValue] = useState('');
  const [savedField, setSavedField] = useState<NumericField | null>(null);
  const [attemptTick, setAttemptTick] = useState(0);

  const loadedWeight = useRef('');
  const loadedWaist = useRef('');
  const touchedWeight = useRef(false);
  const touchedWaist = useRef(false);

  const fieldErrors = useFieldErrors(KNOWN_FIELDS);

  useEffect(() => {
    const weightStr = bodyLog?.weightKg == null ? '' : String(bodyLog.weightKg);
    const waistStr = bodyLog?.waistCm == null ? '' : String(bodyLog.waistCm);
    setWeightValue(weightStr);
    setWaistValue(waistStr);
    loadedWeight.current = weightStr;
    loadedWaist.current = waistStr;
    touchedWeight.current = false;
    touchedWaist.current = false;
    setSavedField(null);
    fieldErrors.reset();
    // `fieldErrors.reset` là hàm ổn định (useCallback rỗng deps) — không
    // cần đưa vào deps, đưa vào không sai nhưng thừa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, bodyLog]);

  function isUnchanged(raw: string, loaded: string): boolean {
    const rawEmpty = raw.trim() === '';
    const loadedEmpty = loaded.trim() === '';
    if (rawEmpty && loadedEmpty) return true;
    if (rawEmpty !== loadedEmpty) return false;
    return Number(raw) === Number(loaded);
  }

  async function commit(field: NumericField, raw: string, loaded: string, touched: boolean) {
    if (!touched) return; // SPEC §5.1 quy tắc 2 — chưa động vào, không gửi
    if (isUnchanged(raw, loaded)) return; // SPEC §5.1 quy tắc 1 — không đổi, không gửi

    let value: number | null;
    if (raw.trim() === '') {
      value = null;
    } else {
      const num = Number(raw);
      if (Number.isNaN(num)) return; // chặn NaN ở client (SPEC §5.4)
      value = num;
    }

    // Xóa lỗi cũ TRƯỚC khi gửi (SPEC §5.2) — lỗi tồn đọng của lần trước
    // trên một ô đã sửa đúng không được hiển thị trong lúc chờ.
    fieldErrors.reset();

    try {
      await putBodyLog(date, { [field]: value } as BodyLogPatch);
      if (field === 'weightKg') loadedWeight.current = raw;
      else loadedWaist.current = raw;
      setSavedField(field);
    } catch (err) {
      if (err instanceof ApiError) {
        fieldErrors.setError(err);
      } else {
        throw err;
      }
    } finally {
      setAttemptTick((t) => t + 1);
    }
  }

  return {
    weightValue,
    waistValue,
    savedField,
    attemptTick,
    fieldErrors,
    onWeightChange: (value: string) => {
      touchedWeight.current = true;
      setWeightValue(value);
    },
    onWaistChange: (value: string) => {
      touchedWaist.current = true;
      setWaistValue(value);
    },
    onWeightBlur: () => {
      void commit('weightKg', weightValue, loadedWeight.current, touchedWeight.current);
    },
    onWaistBlur: () => {
      void commit('waistCm', waistValue, loadedWaist.current, touchedWaist.current);
    },
  };
}
