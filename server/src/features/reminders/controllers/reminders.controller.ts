import { Router, type Request, type Response } from 'express';
import { updateReminderSchema } from '../dtos/reminders.request.js';
import { listReminders, updateReminder } from '../services/reminders.service.js';

/**
 * Controller chỉ làm ba việc: đọc request, validate, gọi service.
 *
 * Không try/catch: Express 5 tự chuyển lỗi từ handler async sang `errorHandler`.
 * `parse()` ném `ZodError` → 400, `AppError.notFound` → 404.
 */
export const remindersController = Router();

remindersController.get('/', async (req: Request, res: Response) => {
  res.json(await listReminders(req.user!.id));
});

// `Request<{ kind: string }>` chứ không phải `Request` trần: kiểu params mặc
// định của Express 5 là `string | string[] | undefined`.
remindersController.put('/:kind', async (req: Request<{ kind: string }>, res: Response) => {
  const input = updateReminderSchema.parse(req.body);
  res.json(await updateReminder(req.user!.id, req.params.kind, input));
});
