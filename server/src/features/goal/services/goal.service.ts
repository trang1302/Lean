import { LOCAL_USER_ID } from '../../../shared/constants.js';
import type { GoalPatch } from '../dtos/goal.request.js';
import { toGoalResponse, type GoalResponse } from '../dtos/goal.response.js';
import * as goalRepository from '../repositories/goal.repository.js';

// Chưa có đăng nhập: mọi thao tác gắn với LOCAL_USER_ID. Khi thêm auth, userId
// đến từ session và chỉ tầng này phải đổi.

/** Không ném 404 khi chưa đặt mục tiêu — `toGoalResponse` trả object toàn `null`. */
export async function getGoal(): Promise<GoalResponse> {
  const goal = await goalRepository.findGoal(LOCAL_USER_ID);
  return toGoalResponse(goal);
}

export async function upsertGoal(patch: GoalPatch): Promise<GoalResponse> {
  const goal = await goalRepository.upsertGoal(LOCAL_USER_ID, patch);
  return toGoalResponse(goal);
}
