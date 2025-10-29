import { Controller } from '@nestjs/common';
import { GrpcMethod, GrpcStreamMethod } from '@nestjs/microservices';
import { Observable, Subject } from 'rxjs';

enum ServingStatus {
  UNKNOWN = 0,
  SERVING = 1,
  NOT_SERVING = 2,
  SERVICE_UNKNOWN = 3,
}

interface HealthCheckRequest {
  service: string;
}

interface HealthCheckResponse {
  status: ServingStatus;
}

/**
 * gRPC Health Controller for payment Service
 * Implements the standard gRPC health checking protocol
 */
@Controller()
export class HealthController {
  private readonly serviceStatus = new Map<string, ServingStatus>();

  constructor() {
    // Set default health status for the service
    this.serviceStatus.set('', ServingStatus.SERVING); // Empty string = overall service health
    this.serviceStatus.set('btd.payment.v1.PaymentService', ServingStatus.SERVING);
  }

  /**
   * Health check method - returns current service status
   */
  @GrpcMethod('Health', 'Check')
  check(data: HealthCheckRequest): HealthCheckResponse {
    const service = data.service || '';
    const status = this.serviceStatus.get(service);

    if (status === undefined) {
      return { status: ServingStatus.SERVICE_UNKNOWN };
    }

    return { status };
  }

  /**
   * Health watch method - streams health status updates
   */
  @GrpcStreamMethod('Health', 'Watch')
  watch(
    data$: Observable<HealthCheckRequest>,
  ): Observable<HealthCheckResponse> {
    const subject = new Subject<HealthCheckResponse>();

    const onNext = (request: HealthCheckRequest) => {
      const service = request.service || '';
      const status = this.serviceStatus.get(service);

      if (status === undefined) {
        subject.next({ status: ServingStatus.SERVICE_UNKNOWN });
      } else {
        subject.next({ status });
      }
    };

    const onComplete = () => subject.complete();
    data$.subscribe({
      next: onNext,
      complete: onComplete,
    });

    return subject.asObservable();
  }

  /**
   * Update service health status (for internal use)
   */
  setServiceStatus(service: string, status: ServingStatus): void {
    this.serviceStatus.set(service, status);
  }
}
