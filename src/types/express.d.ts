/**
 * Type augmentation for Express Request object
 * Adds custom properties used throughout the application
 */

declare namespace Express {
  /**
   * Extended Request interface with custom properties
   */
  export interface Request {
    /**
     * Correlation ID for distributed tracing
     * Either extracted from x-correlation-id header or auto-generated
     */
    correlationId?: string;

    /**
     * The name of the service making the request
     * Extracted from x-calling-service header
     */
    callingService?: string;

    /**
     * Request ID for tracking individual requests
     * Extracted from x-request-id header
     */
    requestId?: string;
  }
}
