import { Router, type Request, type Response } from 'express';
import {
  createMealSchema,
  listMealsQuerySchema,
  mealIdParamSchema,
  updateMealSchema,
} from '../dtos/meals.request.js';
import * as mealsService from '../services/meals.service.js';

/**
 * Router của feature `meals`. `app.ts` đã cắm sẵn ở prefix `/api/meals`, nên
 * đường dẫn ở đây là tương đối.
 *
 * `schema.parse()` ném `ZodError`; Express 5 tự chuyển lỗi từ handler async
 * sang `errorHandler`, ở đó `ZodError` thành 400 kèm mảng `fields`. Không bọc
 * try/catch ở đây — bọc chỉ để `next(err)` là thừa và dễ nuốt mất lỗi.
 */
export function registerMealsRoutes(router: Router): void {
  router.get('/', listMeals);
  router.post('/', createMeal);
  router.patch('/:id', updateMeal);
  router.delete('/:id', deleteMeal);
}

async function listMeals(req: Request, res: Response): Promise<void> {
  const { date } = listMealsQuerySchema.parse(req.query);
  res.json(await mealsService.listMealsByDate(req.user!.id, date));
}

async function createMeal(req: Request, res: Response): Promise<void> {
  const input = createMealSchema.parse(req.body);
  res.status(201).json(await mealsService.addMeal(req.user!.id, input));
}

async function updateMeal(req: Request, res: Response): Promise<void> {
  // Body trước param: body sai là 400, còn id sai chỉ là 404. Báo lỗi dữ liệu
  // trước cho người dùng biết phải sửa gì.
  const input = updateMealSchema.parse(req.body);
  const { id } = mealIdParamSchema.parse(req.params);
  res.json(await mealsService.editMeal(req.user!.id, id, input));
}

async function deleteMeal(req: Request, res: Response): Promise<void> {
  const { id } = mealIdParamSchema.parse(req.params);
  await mealsService.removeMeal(req.user!.id, id);
  res.status(204).end();
}
