import type { ApiError } from '../../types/api';
import { Button } from '../ui/Button';
import s from './ErrorState.module.css';

interface ErrorStateProps {
  /** Nhận NGUYÊN `ApiError`, KHÔNG nhận chuỗi (brief Bước 5 dòng 9) — component
   * tự map `status` → câu chữ hiển thị, để ba trang không mỗi nơi viết một
   * kiểu if/else lệch nhau khi dịch lỗi ra tiếng Việt. */
  error: ApiError;
  /** Gọi lại đúng hàm nạp dữ liệu đã hỏng — SPEC §7.2: "luôn có nút Thử lại
   * gọi lại đúng hàm nạp dữ liệu". */
  onRetry: () => void;
}

const NETWORK_MESSAGE = 'Không kết nối được server — server đã chạy chưa?';
const GENERIC_MESSAGE = 'Đã có lỗi xảy ra. Vui lòng thử lại.';

/**
 * Khối lỗi CẤP TRANG (SPEC §7.1, §7.2) — "đã hỏi rồi, không lấy được".
 *
 * CỐ Ý không hiển thị `error.message` thô: với `status: 500`, message từ
 * server có thể là chi tiết nội bộ không dành cho người dùng cuối đọc
 * (deliverable Bước 5 #2: "không lộ message thô của server"). Ca `status: 0`
 * là ngoại lệ duy nhất được xử riêng vì đó là câu chữ CỐ ĐỊNH của chính
 * `apiClient` sinh ra cho lỗi mạng (lib/apiClient.ts), không phải nội dung
 * đến từ server.
 *
 * Lỗi validate (`400` + `fields[]`) KHÔNG đi qua đây — đó là việc của
 * `FieldError` gắn vào từng ô nhập (SPEC §7.2, §7.3).
 */
export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const message = error.status === 0 ? NETWORK_MESSAGE : GENERIC_MESSAGE;
  return (
    <div className={s.errorState} role="alert">
      <p className={s.message}>{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Thử lại
      </Button>
    </div>
  );
}
