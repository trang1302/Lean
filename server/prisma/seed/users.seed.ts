import 'dotenv/config';
import { prisma } from '../../src/lib/db.js';
import { hashPassword } from '../../src/shared/security/password.js';

/**
 * Ba tài khoản mẫu, một cho mỗi vai trò. **Idempotent** (upsert theo `email`).
 *
 * Chạy SAU `rbac.seed.ts` — script này chỉ gán vai trò đã tồn tại, không tạo
 * vai trò. Thiếu vai trò thì nó dừng và nói rõ, không tạo tài khoản mồ côi.
 *
 * Mật khẩu `123456` chỉ đăng nhập được nhờ quyết định 4 của design doc (đường
 * login không áp min-8; min-8 thuộc đường ĐẶT mật khẩu). Đăng ký mới qua
 * `POST /api/auth/register` vẫn phải ≥ 8 ký tự.
 *
 * ⚠️ Tài khoản demo mật khẩu yếu. Đừng chạy script này trên DB thật đang dùng,
 * và tuyệt đối đừng chạy khi app đã mở ra khỏi localhost.
 *
 * Chạy: `npm run seed:users`
 */

const SEED_PASSWORD = '123456';

const ACCOUNTS = [
  { email: 'user@lean.local', displayName: 'Người dùng', roleCode: 'USER' },
  { email: 'admin@lean.local', displayName: 'Quản trị tài khoản', roleCode: 'ADMIN' },
  { email: 'system@lean.local', displayName: 'Quản trị hệ thống', roleCode: 'SYSTEM_ADMIN' },
] as const;

async function main(): Promise<void> {
  console.log('Seed tài khoản mẫu…');
  const passwordHash = await hashPassword(SEED_PASSWORD);

  for (const account of ACCOUNTS) {
    const role = await prisma.role.findUnique({
      where: { code: account.roleCode },
      select: { id: true },
    });
    if (!role) {
      throw new Error(
        `Chưa có vai trò '${account.roleCode}'. Chạy 'npm run seed:rbac' trước.`,
      );
    }

    await prisma.user.upsert({
      where: { email: account.email },
      // KHÔNG ghi đè `passwordHash` của tài khoản đã tồn tại: chạy lại seed
      // không được đặt lại mật khẩu mà người dùng có thể đã đổi.
      update: { displayName: account.displayName, roleId: role.id },
      create: {
        email: account.email,
        passwordHash,
        displayName: account.displayName,
        roleId: role.id,
      },
    });
    console.log(`  ${account.roleCode.padEnd(12)} ${account.email}`);
  }

  console.log(`Xong. Mật khẩu: ${SEED_PASSWORD}`);
}

await main();
await prisma.$disconnect();
