import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Correlation ID middleware for distributed tracing
 * Extracts or generates correlation ID and calling service headers
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorrelationIdMiddleware.name);

  /**
   * Extract correlation ID and calling service from incoming request
   * @param req Express request object
   * @param res Express response object
   * @param next Next function
   */
  use(req: Request, res: Response, next: NextFunction) {
    // Extract or generate correlation ID
    const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
    
    // Extract calling service (which service is calling us)
    const callingService = req.headers['x-calling-service'] as string || 'unknown';
    
    // Extract request ID if present
    const requestId = req.headers['x-request-id'] as string;
    
    // Add to request object for easy access in controllers/services
    (req as any).correlationId = correlationId;
    (req as any).callingService = callingService;
    (req as any).requestId = requestId;
    
    // Set correlation ID in response headers for client tracking
    res.setHeader('X-Correlation-ID', correlationId);
    
    // Log the request with correlation details
    this.logger.log({
      message: `[${correlationId}] ${req.method} ${req.originalUrl}`,
      correlationId,
      callingService,
      requestId,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      service: 'btd-payment-service',
    });
    
    // Continue to next middleware
    next();
  }
}
