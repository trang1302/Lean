import { Router, type Request, type Response } from 'express';
import { getPermissionCodes } from '../../../shared/rbac/permissionCache.js';
import {
  assignRoleSchema,
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  userIdParamSchema,
} from '../dtos/users.request.js';
import * as usersService from '../services/users.service.js';
import type { Actor } from '../services/users.service.js';

/**
 * API quản trị tài khoản. Mọi route ở đây đã qua `requireAuth` +
 * `permissionGuard` (`user:view` / `user:manage` / `rbac:manage` theo registry),
 * nên controller KHÔNG kiểm quyền lần nữa — nó chỉ dựng `Actor` cho tầng service.
 */
export const usersController = Router();

/**
 * `canManageRbac` đọc từ ĐÚNG nguồn mà guard dùng (cache quyền), không tính lại
 * từ role code. Cache đã ấm vì guard vừa chạy trên chính request này, nên đây
 * không phải một truy vấn thêm.
 */
async function actorOf(req: Request): Promise<Actor> {
  const id = req.user!.id;
  const codes = await getPermissionCodes(id);
  return { id, canManageRbac: codes.has('rbac:manage') };
}

usersController.get('/', async (_req: Request, res: Response) => {
  res.json(await usersService.listUsers());
});

usersController.post('/', async (req: Request, res: Response) => {
  const input = createUserSchema.parse(req.body ?? {});
  res.status(201).json(await usersService.createUser(input));
});

// PHẢI khai trước '/:id' — Express khớp theo thứ tự đăng ký, và '/:id' sẽ nuốt
// '/:id/role' nếu đảo lại thì không, nhưng '/:id/password' và '/:id/role' là
// hai đoạn nên không đụng nhau. Giữ nhóm này lên trên cho dễ đọc.
usersController.post('/:id/password', async (req: Request, res: Response) => {
  const { id } = userIdParamSchema.parse(req.params);
  const { password } = resetPasswordSchema.parse(req.body ?? {});
  await usersService.resetPassword(await actorOf(req), id, password);
  res.status(204).end();
});

usersController.put('/:id/role', async (req: Request, res: Response) => {
  const { id } = userIdParamSchema.parse(req.params);
  const { roleId } = assignRoleSchema.parse(req.body ?? {});
  res.json(await usersService.assignRole(await actorOf(req), id, roleId));
});

usersController.get('/:id', async (req: Request, res: Response) => {
  res.json(await usersService.getUser(userIdParamSchema.parse(req.params).id));
});

usersController.patch('/:id', async (req: Request, res: Response) => {
  const { id } = userIdParamSchema.parse(req.params);
  const input = updateUserSchema.parse(req.body ?? {});
  res.json(await usersService.updateUser(await actorOf(req), id, input));
});

usersController.delete('/:id', async (req: Request, res: Response) => {
  const { id } = userIdParamSchema.parse(req.params);
  await usersService.deleteUser(await actorOf(req), id);
  res.status(204).end();
});
