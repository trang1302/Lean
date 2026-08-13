import { hash, verify } from '@node-rs/argon2';

/**
 * Bọc Argon2id. Module thuần: không DB, không HTTP — cùng tinh thần với
 * shared/stats/ (docs/overview/04-conventions.md:21).
 *
 * Dùng tham số mặc định của @node-rs/argon2. Đã kiểm bản 2.0.2: mặc định là
 * Argon2id, `m=19456,t=2,p=1`. Không tự chỉnh memory/time cost mà không đo —
 * chỉnh sai làm yếu hơn mặc định. `password.test.ts` khóa `$argon2id$` lại để
 * một bản nâng cấp đổi mặc định không đi qua im lặng.
 */
export async function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

/**
 * Thứ tự tham số: (hash, plain) — khớp `verify(hashed, password)` của
 * @node-rs/argon2. Đảo hai tham số cho ra một hàm LUÔN trả `false`, và mọi test
 * kiểu "mật khẩu sai bị từ chối" vẫn xanh; ca "mật khẩu đúng trả true" trong
 * `password.test.ts` là chốt chặn duy nhất bắt được lỗi đó.
 *
 * Trả `false` thay vì ném khi `hashed` không phải chuỗi Argon2 hợp lệ — nhánh
 * "email không tồn tại" của auth.service truyền vào một hash cố định, và một
 * exception ở đó biến 401 thành 500.
 */
export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}

const DUMMY_PLAIN = 'lean-dummy-password-for-timing-equalisation';
let dummyHashPromise: Promise<string> | null = null;

/**
 * Hash cố định dùng cho nhánh "không tìm thấy user" ở auth/SPEC.md §7.3: vẫn
 * chạy verify để hai nhánh mất thời gian tương đương, nếu không thì chênh lệch
 * thời gian phản hồi trở thành oracle đoán email nào có tài khoản.
 *
 * Memoize: chỉ lần gọi ĐẦU TIÊN phải hash. Không dùng top-level await để không
 * cộng thời gian hash vào lúc khởi động server.
 */
export function dummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(DUMMY_PLAIN);
  return dummyHashPromise;
}
