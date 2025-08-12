/**
 * Auth Guard
 * JWT authentication guard for protecting API endpoints
 * 
 * Last Updated On: 2025-08-06
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

interface JwtPayload {
  id: string;
  email: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Validate JWT token and attach user to request
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET') || 'default-secret';
      const payload = jwt.verify(token, secret) as unknown as JwtPayload;

      // Attach user to request
      (request as any).user = {
        id: payload.id,
        email: payload.email,
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Extract token from Authorization header
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}