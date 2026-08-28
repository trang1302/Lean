import type { Request, Response, Router } from 'express';
import {
  bodyLogDateParamSchema,
  bodyLogRangeQuerySchema,
  parseUpsertBodyLog,
} from '../dtos/bodyLogs.request.js';
import * as service from '../services/bodyLogs.service.js';

/**
 * Controller chỉ làm ba việc: validate đầu vào, gọi service, chọn status.
 *
 * Không try/catch: Express 5 tự đẩy lỗi từ handler async sang `errorHandler`.
 * `ZodError` ném ra từ `.parse()` thành 400 kèm danh sách trường, `AppError`
 * từ service thành 404.
 */

function parseDateParam(req: Request): string {
  return bodyLogDateParamSchema.parse(req.params).date;
}

export function registerBodyLogsRoutes(router: Router): void {
  // Router đã được mount ở `/api/body-logs`, nên path ở đây là tương đối.
  router.get('/', async (req: Request, res: Response) => {
    const range = bodyLogRangeQuerySchema.parse(req.query);
    res.json(await service.listInRange(req.user!.id, range));
  });

  router.get('/:date', async (req: Request, res: Response) => {
    res.json(await service.getByDate(req.user!.id, parseDateParam(req)));
  });

  router.put('/:date', async (req: Request, res: Response) => {
    // Validate `:date` trước body: ngày tương lai phải bị chặn kể cả khi body hỏng.
    const date = parseDateParam(req);
    const patch = parseUpsertBodyLog(req.body);
    res.json(await service.upsertByDate(req.user!.id, date, patch));
  });

  router.delete('/:date', async (req: Request, res: Response) => {
    await service.removeByDate(req.user!.id, parseDateParam(req));
    res.status(204).end();
  });
}
