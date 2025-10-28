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
   * Safely extracts a string header value from Express request headers
   * Handles the case where headers can be string, string[], or undefined
   * @param headerValue The header value from request.headers
   * @returns The first string value if array, the string itself, or undefined
   */
  private extractStringHeader(
    headerValue: string | string[] | undefined,
  ): string | undefined {
    if (Array.isArray(headerValue)) {
      return headerValue[0];
    }
    return headerValue;
  }

  /**
   * Extract correlation ID and calling service from incoming request
   * @param req Express request object
   * @param res Express response object
   * @param next Next function
   */
  use(req: Request, res: Response, next: NextFunction): void {
    // Extract or generate correlation ID
    const correlationId: string =
      this.extractStringHeader(req.headers['x-correlation-id']) || uuidv4();

    // Extract calling service (which service is calling us)
    const callingService: string =
      this.extractStringHeader(req.headers['x-calling-service']) || 'unknown';

    // Extract request ID if present
    const requestId: string | undefined = this.extractStringHeader(
      req.headers['x-request-id'],
    );

    // Add to request object for easy access in controllers/services
    req.correlationId = correlationId;
    req.callingService = callingService;
    req.requestId = requestId;

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
