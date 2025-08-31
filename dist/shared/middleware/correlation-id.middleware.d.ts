import { NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
export declare class CorrelationIdMiddleware implements NestMiddleware {
    private readonly logger;
    use(req: Request, res: Response, next: NextFunction): void;
}
