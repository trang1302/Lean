import { prisma } from '../../src/lib/db.js';
import { LOCAL_USER_ID } from '../../src/shared/constants.js';

/**
 * User thứ hai mà các test cách ly dùng. Giá trị phải khớp hằng `OTHER_USER`
 * khai trong từng file test — chúng có sẵn trước helper này.
 */
export const OTHER_USER_ID = 'someone-else';

/**
 * Dựng hai hàng `User` mà bốn bảng dữ liệu trỏ khóa ngoại tới.
 *
 * Bắt buộc trong `beforeEach` của mọi test tạo `BodyLog`/`Meal`/`Goal`/`Reminder`:
 * từ khi bốn bảng đó có `user User @relation(...)`, chèn bản ghi mang một
 * `userId` không tồn tại bị SQLite từ chối với `P2003`.
 *
 * Dựng CẢ `OTHER_USER_ID` kể cả cho file không dùng tới nó. Nhóm test quan
 * trọng nhất của suite là nhóm chứng minh dữ liệu không rò giữa hai người dùng
 * (`không thấy bản ghi của user khác`, …), và nhóm đó cần hàng `User` thứ hai
 * tồn tại thật. Một hàng thừa không làm sai test nào; thiếu nó thì 11 test cách
 * ly chết vì khóa ngoại thay vì vì logic chúng đang kiểm.
 *
 * `upsert` chứ không `create` vì thứ tự file test không đảm bảo và hàng có thể
 * còn sót từ file trước — `create` sẽ ném lỗi trùng khóa chính.
 *
 * Giai đoạn A Task 10 bổ sung vào file này helper dựng agent supertest đã đăng
 * nhập; khi đó những test gọi API sẽ dùng helper đó thay vì hàm này trực tiếp.
 */
export async function seedTestUsers(): Promise<void> {
  await prisma.user.upsert({
    where: { id: LOCAL_USER_ID },
    update: {},
    create: { id: LOCAL_USER_ID, email: 'local@lean.local', passwordHash: 'x' },
  });

  await prisma.user.upsert({
    where: { id: OTHER_USER_ID },
    update: {},
    create: { id: OTHER_USER_ID, email: 'other@lean.local', passwordHash: 'x' },
  });
}
