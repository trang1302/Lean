import type { GoalPatch } from '../dtos/goal.request.js';
import { toGoalResponse, type GoalResponse } from '../dtos/goal.response.js';
import * as goalRepository from '../repositories/goal.repository.js';

// `userId` đến từ phiên, do controller truyền xuống. Service KHÔNG đọc `req` —
// đó là ranh giới 4 lớp ở docs/overview/01-architecture.md:71-76.

/** Không ném 404 khi chưa đặt mục tiêu — `toGoalResponse` trả object toàn `null`. */
export async function getGoal(userId: string): Promise<GoalResponse> {
  const goal = await goalRepository.findGoal(userId);
  return toGoalResponse(goal);
}

export async function upsertGoal(userId: string, patch: GoalPatch): Promise<GoalResponse> {
  const goal = await goalRepository.upsertGoal(userId, patch);
  return toGoalResponse(goal);
}
