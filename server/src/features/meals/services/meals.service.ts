import { AppError } from '../../../shared/errors/AppError.js';
import type { CreateMealInput, UpdateMealInput } from '../dtos/meals.request.js';
import { toMealResponse, type MealResponse } from '../dtos/meals.response.js';
import * as mealsRepository from '../repositories/meals.repository.js';

/**
 * `userId` đến từ phiên, controller truyền xuống làm THAM SỐ ĐẦU TIÊN của mọi
 * hàm. Repository vốn đã nhận `userId` từ đầu nên không phải sửa một dòng nào —
 * đó là điều mà cột `userId` có sẵn từ ngày đầu mua cho ta.
 */

export async function listMealsByDate(userId: string, date: string): Promise<MealResponse[]> {
  const meals = await mealsRepository.findMealsByDate(userId, date);
  return meals.map(toMealResponse);
}

export async function addMeal(userId: string, input: CreateMealInput): Promise<MealResponse> {
  const meal = await mealsRepository.createMeal(userId, input);
  return toMealResponse(meal);
}

/** 404 nếu id không tồn tại HOẶC bản ghi thuộc người dùng khác. */
export async function editMeal(
  userId: string,
  id: string,
  input: UpdateMealInput,
): Promise<MealResponse> {
  const meal = await mealsRepository.updateMealById(userId, id, input);
  if (!meal) throw AppError.notFound(`Không tìm thấy bữa ăn có id ${id}`);
  return toMealResponse(meal);
}

/** 404 nếu id không tồn tại HOẶC bản ghi thuộc người dùng khác. */
export async function removeMeal(userId: string, id: string): Promise<void> {
  const deleted = await mealsRepository.deleteMealById(userId, id);
  if (!deleted) throw AppError.notFound(`Không tìm thấy bữa ăn có id ${id}`);
}
