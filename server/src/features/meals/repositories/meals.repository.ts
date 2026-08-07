import { prisma } from '../../../lib/db.js';
import type { CreateMealInput, UpdateMealInput } from '../dtos/meals.request.js';

/**
 * Một hàng của bảng `Meal`.
 *
 * Khai lại thay vì import type máy sinh của Prisma: kết quả Prisma vẫn khớp
 * theo cấu trúc, còn tầng trên thì không dính vào `src/generated/prisma`
 * (thư mục gitignore, sinh lại mỗi lần `prisma generate`).
 */
export interface MealRecord {
  id: string;
  userId: string;
  date: string;
  slot: string;
  name: string;
  calories: number;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Chỗ DUY NHẤT trong feature này được đụng `prisma`.
 *
 * MỌI truy vấn ở đây mang `userId`, kể cả khi tra theo `id` vốn đã là khóa
 * chính. `Meal.id` là cuid toàn cục nên `where: { id }` trần sẽ chạm được bản
 * ghi của người khác — hôm nay chỉ có một người dùng nên không ai thấy, nhưng
 * ngày thêm auth thì đó là lỗ hổng sửa/xóa dữ liệu người khác. Đây là lý do
 * cột `userId` tồn tại từ đầu.
 */

export function findMealsByDate(userId: string, date: string): Promise<MealRecord[]> {
  return prisma.meal.findMany({
    where: { userId, date },
    // Thứ tự ghi trong ngày — người dùng đọc lại đúng trình tự đã nhập.
    orderBy: { createdAt: 'asc' },
  });
}

export function findMealById(userId: string, id: string): Promise<MealRecord | null> {
  return prisma.meal.findFirst({ where: { id, userId } });
}

export function createMeal(userId: string, input: CreateMealInput): Promise<MealRecord> {
  return prisma.meal.create({
    data: {
      userId,
      date: input.date,
      slot: input.slot,
      name: input.name,
      calories: input.calories,
      note: input.note ?? null,
    },
  });
}

/**
 * Cập nhật partial, trả `null` nếu không có bản ghi nào thuộc `userId` mang `id` đó.
 *
 * Dùng `updateMany` chứ không `findFirst` rồi `update`: điều kiện `userId` nằm
 * ngay trong câu lệnh ghi, không có khe hở giữa lúc kiểm và lúc ghi. Đổi lại
 * phải đọc lại bản ghi sau đó vì `updateMany` chỉ trả về số dòng.
 *
 * Trường `undefined` được Prisma bỏ qua — đúng ngữ nghĩa PATCH. `note: null`
 * thì ghi thật giá trị null.
 */
export async function updateMealById(
  userId: string,
  id: string,
  input: UpdateMealInput,
): Promise<MealRecord | null> {
  const { count } = await prisma.meal.updateMany({
    where: { id, userId },
    data: {
      date: input.date,
      slot: input.slot,
      name: input.name,
      calories: input.calories,
      note: input.note,
    },
  });
  if (count === 0) return null;

  return prisma.meal.findFirst({ where: { id, userId } });
}

/** Trả `false` nếu không có bản ghi nào thuộc `userId` mang `id` đó. */
export async function deleteMealById(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.meal.deleteMany({ where: { id, userId } });
  return count > 0;
}
