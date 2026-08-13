import { prisma } from '../../../lib/db.js';

// Chỗ DUY NHẤT của feature này được import `prisma`.

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  status: string;
}

const PUBLIC_AND_HASH = {
  id: true,
  email: true,
  passwordHash: true,
  displayName: true,
  status: true,
} as const;

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  return prisma.user.findUnique({ where: { email }, select: PUBLIC_AND_HASH });
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  return prisma.user.findUnique({ where: { id }, select: PUBLIC_AND_HASH });
}

export async function emailExists(email: string): Promise<boolean> {
  return (await prisma.user.count({ where: { email } })) > 0;
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  displayName: string | null;
}): Promise<UserRecord> {
  return prisma.user.create({ data, select: PUBLIC_AND_HASH });
}

export async function updateLastLoginAt(userId: string, at: Date): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: at } });
}
