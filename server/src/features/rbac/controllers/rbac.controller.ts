import { Router, type Request, type Response } from 'express';
import { roleIdParamSchema, setRolePermissionsSchema } from '../dtos/rbac.request.js';
import * as rbacService from '../services/rbac.service.js';

/**
 * Hai router tách riêng vì chúng cắm ở hai prefix khác nhau trong `app.ts`
 * (`/api/permissions` và `/api/roles`) — registry khai quyền theo path, nên
 * gộp lại một prefix sẽ làm bảng luật lệch khỏi thực tế.
 *
 * CỐ TÌNH KHÔNG CÓ: tạo vai trò, xóa vai trò, tạo quyền. Danh mục là ĐÓNG, sửa
 * bằng seed + review code — một UI tạo vai trò là một UI để vô tình tạo ra vai
 * trò có `rbac:manage`.
 */
export const permissionsController = Router();

permissionsController.get('/', async (_req: Request, res: Response) => {
  res.json(await rbacService.listPermissions());
});

export const rolesController = Router();

rolesController.get('/', async (_req: Request, res: Response) => {
  res.json(await rbacService.listRoles());
});

rolesController.get('/:roleId/permissions', async (req: Request, res: Response) => {
  const { roleId } = roleIdParamSchema.parse(req.params);
  res.json({ codes: await rbacService.getRolePermissions(roleId) });
});

rolesController.put('/:roleId/permissions', async (req: Request, res: Response) => {
  const { roleId } = roleIdParamSchema.parse(req.params);
  const { codes } = setRolePermissionsSchema.parse(req.body ?? {});
  res.json({ codes: await rbacService.setRolePermissions(roleId, codes) });
});
