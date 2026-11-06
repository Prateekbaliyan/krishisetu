import { PrismaClient } from '@prisma/client';

declare global {
  var prismaInstance: PrismaClient | undefined;
}

export const prisma = global.prismaInstance || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prismaInstance = prisma;
}

