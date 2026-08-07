import { LOCAL_USER_ID } from '../../../shared/constants.js';
import { AppError } from '../../../shared/errors/AppError.js';
import type { CreateMealInput, UpdateMealInput } from '../dtos/meals.request.js';
import { toMealResponse, type MealResponse } from '../dtos/meals.response.js';
import * as mealsRepository from '../repositories/meals.repository.js';

/**
 * Chưa có đăng nhập nên mọi thao tác chạy dưới `LOCAL_USER_ID`. Đây là ranh
 * giới sẽ đổi khi thêm auth: user lấy từ session được truyền vào từ controller,
 * repository bên dưới không phải sửa gì.
 */
const currentUserId = (): string => LOCAL_USER_ID;

export async function listMealsByDate(date: string): Promise<MealResponse[]> {
  const meals = await mealsRepository.findMealsByDate(currentUserId(), date);
  return meals.map(toMealResponse);
}

export async function addMeal(input: CreateMealInput): Promise<MealResponse> {
  const meal = await mealsRepository.createMeal(currentUserId(), input);
  return toMealResponse(meal);
}

/** 404 nếu id không tồn tại HOẶC bản ghi thuộc người dùng khác. */
export async function editMeal(id: string, input: UpdateMealInput): Promise<MealResponse> {
  const meal = await mealsRepository.updateMealById(currentUserId(), id, input);
  if (!meal) throw AppError.notFound(`Không tìm thấy bữa ăn có id ${id}`);
  return toMealResponse(meal);
}

/** 404 nếu id không tồn tại HOẶC bản ghi thuộc người dùng khác. */
export async function removeMeal(id: string): Promise<void> {
  const deleted = await mealsRepository.deleteMealById(currentUserId(), id);
  if (!deleted) throw AppError.notFound(`Không tìm thấy bữa ăn có id ${id}`);
}
