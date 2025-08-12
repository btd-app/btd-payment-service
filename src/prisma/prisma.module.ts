/**
 * Prisma Module
 * Provides database access throughout the application
 * 
 * Last Updated On: 2025-08-06
 */

import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}