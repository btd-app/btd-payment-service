/**
 * Extended Prisma Service Types
 * Temporary types to resolve compilation issues until Prisma client is properly generated
 *
 * This file should be removed once `npx prisma generate` successfully runs
 */

export interface PrismaModelDelegate<T = any> {
  create: (args: any) => Promise<T>;
  findUnique: (args: any) => Promise<T | null>;
  findFirst: (args: any) => Promise<T | null>;
  findMany: (args?: any) => Promise<T[]>;
  update: (args: any) => Promise<T>;
  updateMany: (args: any) => Promise<{ count: number }>;
  upsert: (args: any) => Promise<T>;
  delete: (args: any) => Promise<T>;
  deleteMany: (args?: any) => Promise<{ count: number }>;
}

declare module '../prisma/prisma.service' {
  interface PrismaService {
    subscription: PrismaModelDelegate;
    webhookEvent: PrismaModelDelegate;
    billingHistory: PrismaModelDelegate;
    paymentIntent: PrismaModelDelegate;
    paymentMethod: PrismaModelDelegate;
    featureUsage: PrismaModelDelegate;
    appleTransaction: PrismaModelDelegate;
    userPremiumFeatures: PrismaModelDelegate;
  }
}