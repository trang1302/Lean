import { Router, type Request, type Response } from 'express';
import { goalUpsertSchema, toGoalPatch } from '../dtos/goal.request.js';
import * as goalService from '../services/goal.service.js';

export const goalController = Router();

/**
 * Mục tiêu hiện tại. Chưa đặt → 200 với các trường `null`, KHÔNG phải 404 (spec §5).
 */
goalController.get('/', async (_req: Request, res: Response) => {
  res.json(await goalService.getGoal());
});

/**
 * Upsert mục tiêu. Ba trạng thái cho mỗi trường:
 *   vắng mặt → giữ nguyên · `null` → xóa · có giá trị → ghi đè.
 *
 * Không bọc try/catch: Express 5 tự chuyển lỗi async (kể cả ZodError) sang
 * errorHandler, chỗ đó đã dịch ZodError thành 400 kèm danh sách trường sai.
 */
goalController.put('/', async (req: Request, res: Response) => {
  const parsed = goalUpsertSchema.parse(req.body ?? {});
  // Phân biệt "vắng mặt" với "null" phải đọc body THÔ — sau parse thì mất dấu.
  res.json(await goalService.upsertGoal(toGoalPatch(req.body, parsed)));
});
