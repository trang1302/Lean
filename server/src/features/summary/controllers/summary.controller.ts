import type { Request, Response } from 'express';
import { summaryQuerySchema } from '../dtos/summary.request.js';
import * as summaryService from '../services/summary.service.js';

/**
 * `GET /api/summary?from=&to=`
 *
 * Không try/catch: Express 5 tự đẩy lỗi từ handler async sang `errorHandler`,
 * và `ZodError` được dịch thành 400 kèm danh sách trường sai ở đó.
 */
export async function getSummary(req: Request, res: Response): Promise<void> {
  const range = summaryQuerySchema.parse(req.query);
  res.json(await summaryService.getSummary(range));
}
